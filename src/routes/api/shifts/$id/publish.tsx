import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireCoordinatorOf } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { projectShift } from "~/lib/visibility";

export const Route = createFileRoute("/api/shifts/$id/publish")({
	server: {
		handlers: {
			POST: createHandler({
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
					const [row] = await ctx.db
						.update(shifts)
						.set({ status: "published", updatedAt: new Date() })
						.where(eq(shifts.id, ctx.input.id))
						.returning();
					const shiftAssignments = await ctx.db
						.select()
						.from(assignments)
						.where(eq(assignments.shiftId, row.id));
					return projectShift(row, shiftAssignments, "coordinator", "UTC");
				},
			}),
		},
	},
});
