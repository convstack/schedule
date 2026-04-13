import { createHandler } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardColumns } from "~/db/schema/board-columns";

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

					await ctx.db.transaction(async (tx) => {
						for (let i = 0; i < ctx.input.order.length; i++) {
							await tx
								.update(boardColumns)
								.set({ position: i })
								.where(eq(boardColumns.id, ctx.input.order[i]));
						}
					});

					return { ok: true as const };
				},
			}),
		},
	},
});
