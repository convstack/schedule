import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAnyCoordinator } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { events } from "~/db/schema/events";
export const Route = createFileRoute("/api/events/$id")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					// db.query.events.findFirst is broken in drizzle 1.0.0-beta.18 — use select instead
					const [row] = await ctx.db
						.select()
						.from(events)
						.where(eq(events.id, ctx.input.id))
						.limit(1);
					if (!row) throw httpError.notFound("Event not found");
					return {
						id: row.id,
						title: row.title,
						description: row.description ?? undefined,
						location: row.location ?? undefined,
						start: row.startsAt.toISOString(),
						end: row.endsAt.toISOString(),
						timezone: "UTC",
						category: row.category ?? undefined,
					};
				},
			}),

			PATCH: createHandler({
				db,
				input: z.object({
					id: z.string(),
					title: z.string().min(1).max(200).optional(),
					description: z.string().max(2000).optional(),
					location: z.string().max(200).optional(),
					start: z.string().datetime().optional(),
					end: z.string().datetime().optional(),
					category: z.string().max(64).optional(),
				}),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					const patch: Partial<typeof events.$inferInsert> = {
						updatedAt: new Date(),
					};
					if (ctx.input.title !== undefined) patch.title = ctx.input.title;
					if (ctx.input.description !== undefined)
						patch.description = ctx.input.description;
					if (ctx.input.location !== undefined)
						patch.location = ctx.input.location;
					if (ctx.input.start !== undefined)
						patch.startsAt = new Date(ctx.input.start);
					if (ctx.input.end !== undefined)
						patch.endsAt = new Date(ctx.input.end);
					if (ctx.input.category !== undefined)
						patch.category = ctx.input.category;

					const [row] = await ctx.db
						.update(events)
						.set(patch)
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

			DELETE: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					const result = await ctx.db
						.delete(events)
						.where(eq(events.id, ctx.input.id));
					if (result.rowCount === 0) throw httpError.notFound();
					return { ok: true as const };
				},
			}),
		},
	},
});
