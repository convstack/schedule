import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAnyCoordinator } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { events } from "~/db/schema/events";
export const Route = createFileRoute("/api/events/$id/archive")({
	server: {
		handlers: {
			POST: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					const [row] = await ctx.db
						.update(events)
						.set({ status: "archived", updatedAt: new Date() })
						.where(eq(events.id, ctx.input.id))
						.returning();
					if (!row) throw httpError.notFound();
					return {
						id: row.id,
						title: row.title,
						start: row.startsAt.toISOString(),
						end: row.endsAt.toISOString(),
						timezone: "UTC",
					};
				},
			}),
		},
	},
});
