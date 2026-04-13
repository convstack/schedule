import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireCoordinatorOf } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { computeTier, projectShift } from "~/lib/visibility";

export const Route = createFileRoute("/api/shifts/$id")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					// db.query.shifts.findFirst is broken in drizzle 1.0.0-beta — use select instead
					const [shift] = await ctx.db
						.select()
						.from(shifts)
						.where(eq(shifts.id, ctx.input.id))
						.limit(1);
					if (!shift) throw httpError.notFound("Shift not found");
					const shiftAssignments = await ctx.db
						.select()
						.from(assignments)
						.where(eq(assignments.shiftId, shift.id));
					const tier = computeTier(ctx, shift);
					return projectShift(shift, shiftAssignments, tier, "UTC");
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
					capacity: z.coerce.number().int().min(1).max(100).optional(),
					category: z.string().max(64).optional(),
					trackId: z.string().optional(),
				}),
				handler: async (ctx) => {
					// db.query.shifts.findFirst is broken in drizzle 1.0.0-beta — use select instead
					const [existing] = await ctx.db
						.select()
						.from(shifts)
						.where(eq(shifts.id, ctx.input.id))
						.limit(1);
					if (!existing) throw httpError.notFound();
					requireCoordinatorOf(ctx, existing.departmentId);

					const patch: Partial<typeof shifts.$inferInsert> = {
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
					if (ctx.input.capacity !== undefined)
						patch.capacity = ctx.input.capacity;
					if (ctx.input.category !== undefined)
						patch.category = ctx.input.category;
					if (ctx.input.trackId !== undefined) patch.teamId = ctx.input.trackId;

					const [row] = await ctx.db
						.update(shifts)
						.set(patch)
						.where(eq(shifts.id, ctx.input.id))
						.returning();
					const shiftAssignments = await ctx.db
						.select()
						.from(assignments)
						.where(eq(assignments.shiftId, row.id));
					return projectShift(row, shiftAssignments, "coordinator", "UTC");
				},
			}),

			DELETE: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					// db.query.shifts.findFirst is broken in drizzle 1.0.0-beta — use select instead
					const [existing] = await ctx.db
						.select()
						.from(shifts)
						.where(eq(shifts.id, ctx.input.id))
						.limit(1);
					if (!existing) throw httpError.notFound();
					requireCoordinatorOf(ctx, existing.departmentId);
					await ctx.db.delete(shifts).where(eq(shifts.id, ctx.input.id));
					return { ok: true as const };
				},
			}),
		},
	},
});
