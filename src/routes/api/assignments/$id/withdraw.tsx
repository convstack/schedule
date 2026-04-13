import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAuth,
	requireOwnResource,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { writeHistory } from "~/lib/audit";
import { projectShift } from "~/lib/visibility";

export const Route = createFileRoute("/api/assignments/$id/withdraw")({
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

						requireOwnResource(ctx, assignment.critterUserId);
						requireAuth(ctx); // explicit type narrowing before ctx.user.id

						if (assignment.status === "withdrawn") {
							// Idempotent — already withdrawn, just return the current state
							const [shift] = await tx
								.select()
								.from(shifts)
								.where(eq(shifts.id, assignment.shiftId))
								.limit(1);
							if (!shift) throw httpError.notFound();
							const allAssignments = await tx
								.select()
								.from(assignments)
								.where(eq(assignments.shiftId, shift.id));
							return projectShift(shift, allAssignments, "staffer", "UTC");
						}

						await tx
							.update(assignments)
							.set({ status: "withdrawn", withdrawnAt: new Date() })
							.where(eq(assignments.id, ctx.input.id));

						await writeHistory(tx, {
							assignmentId: assignment.id,
							fromStatus: assignment.status,
							toStatus: "withdrawn",
							changedBy: ctx.user!.id,
						});

						const [shift] = await tx
							.select()
							.from(shifts)
							.where(eq(shifts.id, assignment.shiftId))
							.limit(1);
						if (!shift) throw httpError.notFound();
						const allAssignments = await tx
							.select()
							.from(assignments)
							.where(eq(assignments.shiftId, shift.id));
						return projectShift(shift, allAssignments, "staffer", "UTC");
					});
				},
			}),
		},
	},
});
