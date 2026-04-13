import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAuth,
	requireCoordinatorOf,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { writeHistory } from "~/lib/audit";
import { projectShift } from "~/lib/visibility";

export const Route = createFileRoute("/api/assignments/$id/approve")({
	server: {
		handlers: {
			POST: createHandler({
				db,
				input: z.object({ id: z.string() }),
				handler: async (ctx) => {
					return ctx.db.transaction(async (tx) => {
						// drizzle-beta .query is broken — use select instead
						const [assignment] = await tx
							.select()
							.from(assignments)
							.where(eq(assignments.id, ctx.input.id))
							.limit(1);
						if (!assignment) throw httpError.notFound();

						const [shift] = await tx
							.select()
							.from(shifts)
							.where(eq(shifts.id, assignment.shiftId))
							.limit(1);
						if (!shift) throw httpError.notFound();

						requireCoordinatorOf(ctx, shift.departmentId);
						requireAuth(ctx); // explicit type narrowing before ctx.user.id

						if (assignment.status !== "requested") {
							throw httpError.conflict(
								`Assignment is ${assignment.status}, not requested`,
							);
						}

						// Capacity check inside the transaction to prevent double-approve races
						const approvedCountResult = await tx
							.select({ c: count() })
							.from(assignments)
							.where(
								and(
									eq(assignments.shiftId, shift.id),
									eq(assignments.status, "approved"),
								),
							);
						if (approvedCountResult[0].c >= shift.capacity) {
							throw httpError.conflict(
								`Shift is at capacity (${shift.capacity}). Decline a different request first or raise capacity.`,
							);
						}

						await tx
							.update(assignments)
							.set({
								status: "approved",
								decidedAt: new Date(),
								decidedBy: ctx.user!.id,
							})
							.where(eq(assignments.id, ctx.input.id));

						await writeHistory(tx, {
							assignmentId: assignment.id,
							fromStatus: assignment.status,
							toStatus: "approved",
							changedBy: ctx.user!.id,
						});

						const allAssignments = await tx
							.select()
							.from(assignments)
							.where(eq(assignments.shiftId, shift.id));
						return projectShift(shift, allAssignments, "coordinator", "UTC");
					});
				},
			}),
		},
	},
});
