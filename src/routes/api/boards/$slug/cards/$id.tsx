import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
	requireCoordinatorOf,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardCards } from "~/db/schema/board-cards";
import { boardColumns } from "~/db/schema/board-columns";
import { boards } from "~/db/schema/boards";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Re-index positions 0, 1, 2, … for all cards in a column (closes gaps after move/delete). */
async function reindexColumn(tx: Tx, columnId: string): Promise<void> {
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

/** The card must sit on the board named in the url, whatever its id. */
async function cardOnBoard(
	tx: typeof db,
	slug: string,
	cardId: string,
): Promise<{
	card: typeof boardCards.$inferSelect;
	boardId: string;
}> {
	const [row] = await tx
		.select({ card: boardCards, boardId: boards.id })
		.from(boardCards)
		.innerJoin(boards, eq(boardCards.boardId, boards.id))
		.where(and(eq(boardCards.id, cardId), eq(boards.slug, slug)))
		.limit(1);
	if (!row) throw httpError.notFound("Card not found");
	return row;
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
					const { card, boardId } = await cardOnBoard(
						ctx.db,
						ctx.input.slug,
						ctx.input.id,
					);

					// Department-scoped cards require a coordinator of that dept;
					// department-less cards accept any coordinator role.
					if (card.departmentId) {
						requireCoordinatorOf(ctx, card.departmentId);
					} else {
						requireAnyCoordinator(ctx);
					}
					requireAuth(ctx);

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

					const isMove =
						ctx.input.columnId !== undefined ||
						ctx.input.position !== undefined;

					if (!isMove) {
						await ctx.db
							.update(boardCards)
							.set(patch)
							.where(eq(boardCards.id, card.id));
						return { ok: true as const };
					}

					const targetColumnId = ctx.input.columnId ?? card.columnId;
					const sourceColumnId = card.columnId;
					const [target] = await ctx.db
						.select({ id: boardColumns.id })
						.from(boardColumns)
						.where(
							and(
								eq(boardColumns.id, targetColumnId),
								eq(boardColumns.boardId, boardId),
							),
						)
						.limit(1);
					if (!target) throw httpError.notFound("Column not found");
					const isColumnChange = targetColumnId !== sourceColumnId;

					// one transaction: a move renumbers several cards, and half of
					// that would leave two of them sharing a position
					await ctx.db.transaction(async (tx) => {
						const targetCards = await tx
							.select()
							.from(boardCards)
							.where(eq(boardCards.columnId, targetColumnId))
							.orderBy(asc(boardCards.position));

						const ordered = targetCards.filter((c) => c.id !== card.id);
						// no position asked: the end of another column, or where it already is
						const unasked = isColumnChange
							? ordered.length
							: targetCards.findIndex((c) => c.id === card.id);
						const newPos = Math.min(
							ctx.input.position ?? unasked,
							ordered.length,
						);
						ordered.splice(newPos, 0, card);
						for (let i = 0; i < ordered.length; i++) {
							if (ordered[i].id === card.id) {
								await tx
									.update(boardCards)
									.set({ ...patch, columnId: targetColumnId, position: i })
									.where(eq(boardCards.id, card.id));
							} else if (ordered[i].position !== i) {
								await tx
									.update(boardCards)
									.set({ position: i })
									.where(eq(boardCards.id, ordered[i].id));
							}
						}
						if (isColumnChange) {
							await reindexColumn(tx, sourceColumnId);
						}
					});

					return { ok: true as const };
				},
			}),

			DELETE: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					const { card } = await cardOnBoard(
						ctx.db,
						ctx.input.slug,
						ctx.input.id,
					);

					if (card.departmentId) {
						requireCoordinatorOf(ctx, card.departmentId);
					} else {
						requireAnyCoordinator(ctx);
					}
					requireAuth(ctx);

					await ctx.db.transaction(async (tx) => {
						await tx.delete(boardCards).where(eq(boardCards.id, card.id));
						await reindexColumn(tx, card.columnId);
					});

					return { ok: true as const };
				},
			}),
		},
	},
});
