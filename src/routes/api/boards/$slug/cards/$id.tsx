import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
	requireCoordinatorOf,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardCards } from "~/db/schema/board-cards";

/** Re-index positions 0, 1, 2, … for all cards in a column (closes gaps after move/delete). */
async function reindexColumn(tx: typeof db, columnId: string): Promise<void> {
	const remaining = await tx
		.select()
		.from(boardCards)
		.where(eq(boardCards.columnId, columnId))
		.orderBy(asc(boardCards.position));
	for (let i = 0; i < remaining.length; i++) {
		if (remaining[i].position !== i) {
			await tx
				.update(boardCards)
				.set({ position: i })
				.where(eq(boardCards.id, remaining[i].id));
		}
	}
}

export const Route = createFileRoute("/api/boards/$slug/cards/$id")({
	server: {
		handlers: {
			PATCH: createHandler({
				db,
				input: z.object({
					slug: z.string(),
					id: z.string(),
					columnId: z.string().optional(),
					position: z.coerce.number().int().min(0).optional(),
					title: z.string().min(1).max(200).optional(),
					description: z.string().max(2000).optional(),
					priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
					departmentId: z.string().nullable().optional(),
					teamId: z.string().nullable().optional(),
					assigneeUserId: z.string().nullable().optional(),
					collaboratorUserIds: z.array(z.string()).nullable().optional(),
					labels: z.string().optional(),
					progress: z.coerce.number().int().min(0).max(100).optional(),
					link: z.string().max(500).optional(),
				}),
				handler: async (ctx) => {
					const [card] = await ctx.db
						.select()
						.from(boardCards)
						.where(eq(boardCards.id, ctx.input.id))
						.limit(1);
					if (!card) throw httpError.notFound("Card not found");

					// Department-scoped cards require a coordinator of that dept;
					// department-less cards accept any coordinator role.
					if (card.departmentId) {
						requireCoordinatorOf(ctx, card.departmentId);
					} else {
						requireAnyCoordinator(ctx);
					}
					requireAuth(ctx);

					const isMove =
						ctx.input.columnId !== undefined ||
						ctx.input.position !== undefined;

					if (isMove) {
						const targetColumnId = ctx.input.columnId ?? card.columnId;
						const sourceColumnId = card.columnId;
						const isColumnChange = targetColumnId !== sourceColumnId;

						const targetCards = await ctx.db
							.select()
							.from(boardCards)
							.where(eq(boardCards.columnId, targetColumnId))
							.orderBy(asc(boardCards.position));

						const maxPos = isColumnChange
							? targetCards.length
							: targetCards.length - 1;
						const newPos = Math.min(
							ctx.input.position ?? maxPos,
							Math.max(0, maxPos),
						);

						await ctx.db
							.update(boardCards)
							.set({
								columnId: targetColumnId,
								position: newPos,
								updatedAt: new Date(),
							})
							.where(eq(boardCards.id, card.id));

						await reindexColumn(ctx.db, targetColumnId);
						if (isColumnChange) {
							await reindexColumn(ctx.db, sourceColumnId);
						}
					} else {
						const patch: Partial<typeof boardCards.$inferInsert> = {
							updatedAt: new Date(),
						};
						if (ctx.input.title !== undefined) patch.title = ctx.input.title;
						if (ctx.input.description !== undefined)
							patch.description = ctx.input.description;
						if (ctx.input.priority !== undefined)
							patch.priority = ctx.input.priority;
						if (ctx.input.departmentId !== undefined)
							patch.departmentId = ctx.input.departmentId;
						if (ctx.input.teamId !== undefined) patch.teamId = ctx.input.teamId;
						if (ctx.input.assigneeUserId !== undefined)
							patch.assigneeUserId = ctx.input.assigneeUserId;
						if (ctx.input.collaboratorUserIds !== undefined)
							patch.collaboratorUserIds = ctx.input.collaboratorUserIds;
						if (ctx.input.labels !== undefined) patch.labels = ctx.input.labels;
						if (ctx.input.progress !== undefined)
							patch.progress = ctx.input.progress;
						if (ctx.input.link !== undefined) patch.link = ctx.input.link;

						await ctx.db
							.update(boardCards)
							.set(patch)
							.where(eq(boardCards.id, card.id));
					}

					return { ok: true as const };
				},
			}),

			DELETE: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					const [card] = await ctx.db
						.select()
						.from(boardCards)
						.where(eq(boardCards.id, ctx.input.id))
						.limit(1);
					if (!card) throw httpError.notFound("Card not found");

					if (card.departmentId) {
						requireCoordinatorOf(ctx, card.departmentId);
					} else {
						requireAnyCoordinator(ctx);
					}
					requireAuth(ctx);

					const columnId = card.columnId;
					await ctx.db.delete(boardCards).where(eq(boardCards.id, card.id));
					await reindexColumn(ctx.db, columnId);

					return { ok: true as const };
				},
			}),
		},
	},
});
