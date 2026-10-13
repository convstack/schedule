import { beforeEach, describe, expect, it } from "vitest";
import { asUser } from "../support/caller";
import { seed, tables } from "../support/fake-db";
import { handlers } from "../support/route";

const get = async (slug: string, id: string) => {
	const { Route } = await import(
		"~/routes/api/boards/$slug/cards/$id/comments"
	);
	return handlers(Route).GET({
		request: new Request(`http://x/api/boards/${slug}/cards/${id}/comments`),
		params: { slug, id },
	});
};

const post = async (slug: string, id: string) => {
	const { Route } = await import(
		"~/routes/api/boards/$slug/cards/$id/comments"
	);
	return handlers(Route).POST({
		request: new Request(`http://x/api/boards/${slug}/cards/${id}/comments`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		}),
		params: { slug, id },
	});
};

beforeEach(() => {
	asUser("volunteer");
	seed({
		boards: [
			{ id: "b1", slug: "stage" },
			{ id: "b2", slug: "other" },
		],
		boardCards: [
			{ id: "k1", boardId: "b1" },
			{ id: "k2", boardId: "b2" },
		],
		boardCardComments: [
			{
				id: "m1",
				cardId: "k2",
				userId: "someone",
				content: "private to the other board",
				createdAt: new Date("2026-10-01"),
			},
		],
	});
});

describe("card comments", () => {
	it("are read through the board the card is on", async () => {
		expect((await get("other", "k2")).status).toBe(200);
	});

	it("are not found for a card of another board", async () => {
		const res = await get("stage", "k2");
		expect(res.status).toBe(404);
		expect(await res.text()).not.toContain("private to the other board");
	});

	it("can be added through the board the card is on", async () => {
		expect((await post("stage", "k1")).status).toBe(200);
		expect(tables.boardCardComments).toHaveLength(2);
	});

	it("can't be added to a card of another board", async () => {
		expect((await post("stage", "k2")).status).toBe(404);
		expect(tables.boardCardComments).toHaveLength(1);
	});
});
