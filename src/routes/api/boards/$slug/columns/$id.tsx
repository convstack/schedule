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

export const Route = createFileRoute("/api/boards/$slug/columns/$id")({
	server: {
		handlers: {
			DELETE: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					requireAuth(ctx);
					if (!ctx.permissions.includes("schedule:manage")) {
						requireAnyCoordinator(ctx);
					}
					const [col] = await ctx.db
						.select({ id: boardColumns.id, createdBy: boards.createdBy })
						.from(boardColumns)
						.innerJoin(boards, eq(boardColumns.boardId, boards.id))
						.where(
							and(
								eq(boardColumns.id, ctx.input.id),
								eq(boards.slug, ctx.input.slug),
							),
						)
						.limit(1);
					if (!col) throw httpError.notFound("Column not found");
					// deleting a column cascades to every card in it, other departments' included
					if (
						col.createdBy !== ctx.user?.id &&
						!ctx.permissions.includes("schedule:manage")
					) {
						throw httpError.forbidden(
							"Only the board's creator or a schedule manager can delete a column",
						);
					}
					await ctx.db
						.delete(boardColumns)
						.where(eq(boardColumns.id, ctx.input.id));
					return { ok: true as const };
				},
			}),
		},
	},
});
