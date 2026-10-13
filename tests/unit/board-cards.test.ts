import { beforeEach, describe, expect, it, vi } from "vitest";
import { asUser, coordinatorOf } from "../support/caller";
import { faults, seed, tables, writes } from "../support/fake-db";
import { handlers } from "../support/route";

const patch = async (slug: string, id: string, body: object) => {
	const { Route } = await import("~/routes/api/boards/$slug/cards/$id");
	return handlers(Route).PATCH({
		request: new Request(`http://x/api/boards/${slug}/cards/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
		params: { slug, id },
	});
};

const remove = async (slug: string, id: string) => {
	const { Route } = await import("~/routes/api/boards/$slug/cards/$id");
	return handlers(Route).DELETE({
		request: new Request(`http://x/api/boards/${slug}/cards/${id}`, {
			method: "DELETE",
		}),
		params: { slug, id },
	});
};

const card = (id: string) => tables.boardCards.find((c) => c.id === id);

beforeEach(() => {
	asUser("coordinator", { orgRoles: [coordinatorOf("d1")] });
	seed({
		boards: [
			{ id: "b1", slug: "stage" },
			{ id: "b2", slug: "other" },
		],
		boardColumns: [
			{ id: "c1", boardId: "b1" },
			{ id: "c2", boardId: "b1" },
			{ id: "x1", boardId: "b2" },
		],
		boardCards: [
			{
				id: "k1",
				boardId: "b1",
				columnId: "c1",
				title: "Stage card",
				position: 0,
				departmentId: null,
			},
			{
				id: "k2",
				boardId: "b2",
				columnId: "x1",
				title: "Other card",
				position: 0,
				departmentId: null,
			},
			{
				id: "k3",
				boardId: "b1",
				columnId: "c1",
				title: "Security card",
				position: 1,
				departmentId: "d9",
			},
		],
	});
});

describe("editing a card", () => {
	it("edits a card on the board", async () => {
		expect((await patch("stage", "k1", { title: "Renamed" })).status).toBe(200);
		expect(card("k1")?.title).toBe("Renamed");
	});

	it("doesn't find a card of another board under this board's slug", async () => {
		expect((await patch("stage", "k2", { title: "Hijacked" })).status).toBe(
			404,
		);
		expect(card("k2")?.title).toBe("Other card");
	});

	it("moves a card to another column of the same board", async () => {
		expect((await patch("stage", "k1", { columnId: "c2" })).status).toBe(200);
		expect(card("k1")?.columnId).toBe("c2");
	});

	it("doesn't move a card into a column of another board", async () => {
		expect((await patch("stage", "k1", { columnId: "x1" })).status).toBe(404);
		expect(card("k1")?.columnId).toBe("c1");
	});

	it("refuses a coordinator of another department on a department's card", async () => {
		expect((await patch("stage", "k3", { title: "Mine now" })).status).toBe(
			403,
		);
		expect(card("k3")?.title).toBe("Security card");
	});
});

describe("deleting a card", () => {
	it("deletes a card on the board", async () => {
		expect((await remove("stage", "k1")).status).toBe(200);
		expect(card("k1")).toBeUndefined();
	});

	it("doesn't find a card of another board under this board's slug", async () => {
		expect((await remove("stage", "k2")).status).toBe(404);
		expect(card("k2")).toBeDefined();
	});

	it("refuses a coordinator of another department on a department's card", async () => {
		expect((await remove("stage", "k3")).status).toBe(403);
		expect(card("k3")).toBeDefined();
	});
});

describe("moving a card within a board", () => {
	beforeEach(() => {
		seed({
			boards: [{ id: "b1", slug: "stage" }],
			boardColumns: [
				{ id: "c1", boardId: "b1" },
				{ id: "c2", boardId: "b1" },
			],
			boardCards: [
				{ id: "a", boardId: "b1", columnId: "c1", position: 0 },
				{ id: "b", boardId: "b1", columnId: "c1", position: 1 },
				{ id: "c", boardId: "b1", columnId: "c1", position: 2 },
				{ id: "d", boardId: "b1", columnId: "c2", position: 0 },
				{ id: "e", boardId: "b1", columnId: "c2", position: 1 },
			],
		});
	});

	const order = (columnId: string) =>
		tables.boardCards
			.filter((c) => c.columnId === columnId)
			.sort((x, y) => Number(x.position) - Number(y.position))
			.map((c) => `${c.id}:${c.position}`);

	it("puts a card where it was dropped inside its own column", async () => {
		expect((await patch("stage", "c", { position: 0 })).status).toBe(200);
		expect(order("c1")).toEqual(["c:0", "a:1", "b:2"]);
	});

	it("moves a card down inside its own column", async () => {
		expect((await patch("stage", "a", { position: 1 })).status).toBe(200);
		expect(order("c1")).toEqual(["b:0", "a:1", "c:2"]);
	});

	it("inserts a card into another column and closes the gap behind it", async () => {
		expect(
			(await patch("stage", "a", { columnId: "c2", position: 1 })).status,
		).toBe(200);
		expect(order("c2")).toEqual(["d:0", "a:1", "e:2"]);
		expect(order("c1")).toEqual(["b:0", "c:1"]);
	});

	it("appends to the end of another column when no position is given", async () => {
		expect((await patch("stage", "a", { columnId: "c2" })).status).toBe(200);
		expect(order("c2")).toEqual(["d:0", "e:1", "a:2"]);
	});

	it("applies the other fields sent with a move", async () => {
		expect(
			(
				await patch("stage", "a", {
					columnId: "c2",
					title: "Moved and renamed",
				})
			).status,
		).toBe(200);
		expect(order("c2")).toEqual(["d:0", "e:1", "a:2"]);
		expect(tables.boardCards.find((c) => c.id === "a")?.title).toBe(
			"Moved and renamed",
		);
	});

	it("keeps a card in place when its own column is named without a position", async () => {
		expect((await patch("stage", "a", { columnId: "c1" })).status).toBe(200);
		expect(order("c1")).toEqual(["a:0", "b:1", "c:2"]);
	});

	it("writes the card once when a move comes with other fields", async () => {
		await patch("stage", "a", { columnId: "c2", title: "Moved and renamed" });
		expect(writes.filter((w) => w.id === "a")).toHaveLength(1);
	});

	it("leaves the column as it was when a write fails midway", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		faults.failUpdate = 2;
		expect((await patch("stage", "a", { position: 2 })).status).toBe(500);
		expect(order("c1")).toEqual(["a:0", "b:1", "c:2"]);
		vi.restoreAllMocks();
	});

	it("keeps a card that could not be fully deleted", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		faults.failUpdate = 1;
		expect((await remove("stage", "a")).status).toBe(500);
		expect(order("c1")).toEqual(["a:0", "b:1", "c:2"]);
		vi.restoreAllMocks();
	});

	it("keeps a position past the end at the end", async () => {
		expect((await patch("stage", "a", { position: 99 })).status).toBe(200);
		expect(order("c1")).toEqual(["b:0", "c:1", "a:2"]);
	});
});
