import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardColumns } from "~/db/schema/board-columns";

export const Route = createFileRoute("/api/boards/$slug/columns/$id")({
	server: {
		handlers: {
			DELETE: createHandler({
				db,
				input: z.object({ slug: z.string(), id: z.string() }),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);
					const [col] = await ctx.db
						.select()
						.from(boardColumns)
						.where(eq(boardColumns.id, ctx.input.id))
						.limit(1);
					if (!col) throw httpError.notFound("Column not found");
					// Cascade deletes cards in this column (FK onDelete: cascade)
					await ctx.db
						.delete(boardColumns)
						.where(eq(boardColumns.id, ctx.input.id));
					return { ok: true as const };
				},
			}),
		},
	},
});
