import { beforeEach, describe, expect, it } from "vitest";
import { asService, asUser, coordinatorOf } from "../support/caller";
import { seed, tables } from "../support/fake-db";
import { handlers } from "../support/route";

const removeColumn = async (slug: string, id: string) => {
	const { Route } = await import("~/routes/api/boards/$slug/columns/$id");
	return handlers(Route).DELETE({
		request: new Request(`http://x/api/boards/${slug}/columns/${id}`, {
			method: "DELETE",
		}),
		params: { slug, id },
	});
};

const reorder = async (slug: string, order: string[]) => {
	const { Route } = await import("~/routes/api/boards/$slug/columns/reorder");
	return handlers(Route).PATCH({
		request: new Request(`http://x/api/boards/${slug}/columns/reorder`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ order }),
		}),
		params: { slug },
	});
};

const positions = () =>
	Object.fromEntries(tables.boardColumns.map((c) => [c.id, c.position]));

beforeEach(() => {
	asUser("creator", { orgRoles: [coordinatorOf("d1")] });
	seed({
		boards: [
			{ id: "b1", slug: "stage", createdBy: "creator" },
			{ id: "b2", slug: "other", createdBy: "someone" },
		],
		boardColumns: [
			{ id: "c1", boardId: "b1", position: 0 },
			{ id: "c2", boardId: "b1", position: 1 },
			{ id: "x1", boardId: "b2", position: 0 },
		],
	});
});

describe("deleting a column", () => {
	it("lets the coordinator who created the board", async () => {
		expect((await removeColumn("stage", "c1")).status).toBe(200);
		expect(tables.boardColumns.map((c) => c.id)).toEqual(["c2", "x1"]);
	});

	it("doesn't find a column of another board under this board's slug", async () => {
		expect((await removeColumn("stage", "x1")).status).toBe(404);
		expect(tables.boardColumns).toHaveLength(3);
	});

	it("refuses another coordinator", async () => {
		asUser("other", { orgRoles: [coordinatorOf("d2")] });
		expect((await removeColumn("stage", "c1")).status).toBe(403);
		expect(tables.boardColumns).toHaveLength(3);
	});

	it("lets a schedule manager", async () => {
		asUser("other", {
			permissions: ["schedule:manage"],
			orgRoles: [coordinatorOf("d2")],
		});
		expect((await removeColumn("stage", "c1")).status).toBe(200);
	});

	it("refuses someone who coordinates nothing and manages nothing", async () => {
		asUser("creator");
		expect((await removeColumn("stage", "c1")).status).toBe(403);
		expect(tables.boardColumns).toHaveLength(3);
	});

	it("refuses a service, even one holding the permission in its scope", async () => {
		asService("ledger", ["schedule:manage"]);
		expect((await removeColumn("stage", "c1")).status).toBe(401);
		expect(tables.boardColumns).toHaveLength(3);
	});

	it("lets a schedule manager who coordinates nothing", async () => {
		asUser("manager", { permissions: ["schedule:manage"] });
		expect((await removeColumn("stage", "c1")).status).toBe(200);
	});
});

describe("reordering columns", () => {
	it("reorders the columns of the board", async () => {
		expect((await reorder("stage", ["c2", "c1"])).status).toBe(200);
		expect(positions()).toEqual({ c1: 1, c2: 0, x1: 0 });
	});

	it("refuses an order naming a column of another board and changes nothing", async () => {
		expect((await reorder("stage", ["x1", "c1"])).status).toBe(404);
		expect(positions()).toEqual({ c1: 0, c2: 1, x1: 0 });
	});

	it("refuses an order that repeats a column and changes nothing", async () => {
		expect((await reorder("stage", ["c1", "c1"])).status).toBe(400);
		expect(positions()).toEqual({ c1: 0, c2: 1, x1: 0 });
	});

	it("refuses an order that leaves a column out and changes nothing", async () => {
		expect((await reorder("stage", ["c2"])).status).toBe(400);
		expect(positions()).toEqual({ c1: 0, c2: 1, x1: 0 });
	});

	it("reports a board that doesn't exist", async () => {
		expect((await reorder("nowhere", ["c1"])).status).toBe(404);
	});
});
