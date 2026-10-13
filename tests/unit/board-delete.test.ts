import { beforeEach, describe, expect, it } from "vitest";
import { asService, asUser, coordinatorOf } from "../support/caller";
import { seed, tables } from "../support/fake-db";
import { handlers } from "../support/route";

const remove = async (slug: string) => {
	const { Route } = await import("~/routes/api/boards/$slug");
	return handlers(Route).DELETE({
		request: new Request(`http://x/api/boards/${slug}`, { method: "DELETE" }),
		params: { slug },
	});
};

beforeEach(() => {
	seed({ boards: [{ id: "b1", slug: "stage", createdBy: "creator" }] });
});

describe("deleting a board", () => {
	it("lets the coordinator who created it", async () => {
		asUser("creator", { orgRoles: [coordinatorOf("d1")] });
		expect((await remove("stage")).status).toBe(200);
		expect(tables.boards).toEqual([]);
	});

	it("refuses another coordinator, who would wipe the cards of other departments", async () => {
		asUser("other", { orgRoles: [coordinatorOf("d2")] });
		expect((await remove("stage")).status).toBe(403);
		expect(tables.boards).toHaveLength(1);
	});

	it("lets a schedule manager", async () => {
		asUser("other", {
			permissions: ["schedule:manage"],
			orgRoles: [coordinatorOf("d2")],
		});
		expect((await remove("stage")).status).toBe(200);
		expect(tables.boards).toEqual([]);
	});

	it("lets a schedule manager who coordinates nothing", async () => {
		asUser("manager", {
			permissions: ["schedule:manage"],
			orgRoles: [{ orgId: "d3", slug: "d3", role: "member" }],
		});
		expect((await remove("stage")).status).toBe(200);
		expect(tables.boards).toEqual([]);
	});

	it("refuses someone who coordinates nothing", async () => {
		asUser("creator");
		expect((await remove("stage")).status).toBe(403);
		expect(tables.boards).toHaveLength(1);
	});

	it("refuses a service, even one holding the permission in its scope", async () => {
		asService("ledger", ["schedule:manage"]);
		expect((await remove("stage")).status).toBe(401);
		expect(tables.boards).toHaveLength(1);
	});

	it("reports a board that doesn't exist", async () => {
		asUser("creator", { orgRoles: [coordinatorOf("d1")] });
		expect((await remove("nowhere")).status).toBe(404);
	});
});
