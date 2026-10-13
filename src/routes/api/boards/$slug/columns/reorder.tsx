import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardColumns } from "~/db/schema/board-columns";
import { boards } from "~/db/schema/boards";

export const Route = createFileRoute("/api/boards/$slug/columns/reorder")({
	server: {
		handlers: {
			PATCH: createHandler({
				db,
				input: z.object({
					slug: z.string(),
					order: z.array(z.string()).min(1),
				}),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);

					const [board] = await ctx.db
						.select({ id: boards.id })
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (!board) throw httpError.notFound("Board not found");

					const own = await ctx.db
						.select({ id: boardColumns.id })
						.from(boardColumns)
						.where(eq(boardColumns.boardId, board.id));
					const ownIds = new Set(own.map((c) => c.id));
					if (ctx.input.order.some((id) => !ownIds.has(id))) {
						throw httpError.notFound("Column not found on this board");
					}
					if (
						ctx.input.order.length !== ownIds.size ||
						new Set(ctx.input.order).size !== ctx.input.order.length
					) {
						throw httpError.badRequest(
							"The order must name each column of the board once",
						);
					}

					await ctx.db.transaction(async (tx) => {
						for (let i = 0; i < ctx.input.order.length; i++) {
							await tx
								.update(boardColumns)
								.set({ position: i })
								.where(
									and(
										eq(boardColumns.id, ctx.input.order[i]),
										eq(boardColumns.boardId, board.id),
									),
								);
						}
					});

					return { ok: true as const };
				},
			}),
		},
	},
});
