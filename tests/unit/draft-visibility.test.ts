import { beforeEach, describe, expect, it } from "vitest";
import { asUser, coordinatorOf } from "../support/caller";
import { seed } from "../support/fake-db";
import { handlers } from "../support/route";

const startsAt = new Date("2026-10-20T10:00:00Z");
const endsAt = new Date("2026-10-20T12:00:00Z");

const getEvent = async (id: string) => {
	const { Route } = await import("~/routes/api/events/$id");
	return handlers(Route).GET({
		request: new Request(`http://x/api/events/${id}`),
		params: { id },
	});
};

const getShift = async (id: string) => {
	const { Route } = await import("~/routes/api/shifts/$id");
	return handlers(Route).GET({
		request: new Request(`http://x/api/shifts/${id}`),
		params: { id },
	});
};

beforeEach(() => {
	asUser("volunteer");
	seed({
		events: [
			{ id: "e-pub", title: "Opening", status: "published", startsAt, endsAt },
			{ id: "e-draft", title: "Secret", status: "draft", startsAt, endsAt },
			{ id: "e-old", title: "Old", status: "archived", startsAt, endsAt },
		],
		shifts: [
			{
				id: "s-pub",
				title: "Doors",
				status: "published",
				departmentId: "d1",
				capacity: 2,
				startsAt,
				endsAt,
			},
			{
				id: "s-draft",
				title: "Teardown",
				status: "draft",
				departmentId: "d1",
				capacity: 2,
				startsAt,
				endsAt,
			},
			{
				id: "s-old",
				title: "Old",
				status: "archived",
				departmentId: "d1",
				capacity: 2,
				startsAt,
				endsAt,
			},
		],
		assignments: [],
	});
});

describe("reading one event", () => {
	it("shows a published event to anyone", async () => {
		expect((await getEvent("e-pub")).status).toBe(200);
	});

	it("hides drafts and archived events from people who coordinate nothing", async () => {
		expect((await getEvent("e-draft")).status).toBe(404);
		expect((await getEvent("e-old")).status).toBe(404);
	});

	it("shows them to a coordinator", async () => {
		asUser("coordinator", { orgRoles: [coordinatorOf("d1")] });
		expect((await getEvent("e-draft")).status).toBe(200);
		expect((await getEvent("e-old")).status).toBe(200);
	});
});

describe("reading one shift", () => {
	it("shows a published shift to anyone", async () => {
		expect((await getShift("s-pub")).status).toBe(200);
	});

	it("hides drafts and archived shifts from people who coordinate nothing", async () => {
		expect((await getShift("s-draft")).status).toBe(404);
		expect((await getShift("s-old")).status).toBe(404);
	});

	it("shows them to a coordinator", async () => {
		asUser("coordinator", { orgRoles: [coordinatorOf("d1")] });
		expect((await getShift("s-draft")).status).toBe(200);
		expect((await getShift("s-old")).status).toBe(200);
	});
});
