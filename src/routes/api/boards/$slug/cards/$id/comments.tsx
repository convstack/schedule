import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardCardComments } from "~/db/schema/board-card-comments";
import { boardCards } from "~/db/schema/board-cards";
import { lookupManyUserNames } from "~/lib/user-lookup";

export const Route = createFileRoute("/api/boards/$slug/cards/$id/comments")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					const [card] = await ctx.db
						.select()
						.from(boardCards)
						.where(eq(boardCards.id, ctx.input.id))
						.limit(1);
					if (!card) throw httpError.notFound("Card not found");

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

					const [card] = await ctx.db
						.select()
						.from(boardCards)
						.where(eq(boardCards.id, ctx.input.id))
						.limit(1);
					if (!card) throw httpError.notFound("Card not found");

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
