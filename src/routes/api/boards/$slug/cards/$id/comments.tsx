import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardCardComments } from "~/db/schema/board-card-comments";
import { boardCards } from "~/db/schema/board-cards";
import { boards } from "~/db/schema/boards";
import { lookupManyUserNames } from "~/lib/user-lookup";

// the card must sit on the board named in the url, whatever its id
async function cardOnBoard(tx: typeof db, slug: string, cardId: string) {
	const [row] = await tx
		.select({ id: boardCards.id })
		.from(boardCards)
		.innerJoin(boards, eq(boardCards.boardId, boards.id))
		.where(and(eq(boardCards.id, cardId), eq(boards.slug, slug)))
		.limit(1);
	if (!row) throw httpError.notFound("Card not found");
}

export const Route = createFileRoute("/api/boards/$slug/cards/$id/comments")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					await cardOnBoard(ctx.db, ctx.input.slug, ctx.input.id);

					const comments = await ctx.db
						.select()
						.from(boardCardComments)
						.where(eq(boardCardComments.cardId, ctx.input.id))
						.orderBy(asc(boardCardComments.createdAt));

					const names = await lookupManyUserNames(
						comments.map((c) => c.userId),
					);

					return {
						comments: comments.map((c) => ({
							id: c.id,
							author: { name: names.get(c.userId) ?? "Unknown" },
							content: c.content,
							createdAt: c.createdAt.toISOString(),
						})),
					};
				},
			}),

			POST: createHandler({
				db,
				input: z.object({
					slug: z.string(),
					id: z.string(),
					content: z.string().min(1).max(5000),
				}),
				handler: async (ctx) => {
					requireAuth(ctx);

					await cardOnBoard(ctx.db, ctx.input.slug, ctx.input.id);

					const [comment] = await ctx.db
						.insert(boardCardComments)
						.values({
							cardId: ctx.input.id,
							userId: ctx.user.id,
							content: ctx.input.content,
						})
						.returning();

					return {
						comment: {
							id: comment.id,
							author: { name: ctx.user.name },
							content: comment.content,
							createdAt: comment.createdAt.toISOString(),
						},
					};
				},
			}),
		},
	},
});
