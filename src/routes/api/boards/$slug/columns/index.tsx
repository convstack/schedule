import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "~/db";
import { boardColumns } from "~/db/schema/board-columns";
import { boards } from "~/db/schema/boards";

export const Route = createFileRoute("/api/boards/$slug/columns/")({
	server: {
		handlers: {
			POST: createHandler({
				db,
				input: z.object({
					slug: z.string(),
					label: z.string().min(1).max(100),
					color: z.string().optional(),
				}),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);

					const [board] = await ctx.db
						.select()
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (!board) throw httpError.notFound("Board not found");

					const existing = await ctx.db
						.select()
						.from(boardColumns)
						.where(eq(boardColumns.boardId, board.id))
						.orderBy(asc(boardColumns.position));
					const nextPos =
						existing.length > 0
							? existing[existing.length - 1].position + 1
							: 0;

					const [col] = await ctx.db
						.insert(boardColumns)
						.values({
							id: nanoid(),
							boardId: board.id,
							label: ctx.input.label,
							color: ctx.input.color,
							position: nextPos,
						})
						.returning();

					return { ok: true as const, column: col };
				},
			}),
		},
	},
});
