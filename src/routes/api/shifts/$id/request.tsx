import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { writeHistory } from "~/lib/audit";
import { projectShift } from "~/lib/visibility";

export const Route = createFileRoute("/api/shifts/$id/request")({
	server: {
		handlers: {
			POST: createHandler({
				db,
				input: z.object({
					id: z.string(),
					note: z.string().max(500).optional(),
				}),
				handler: async (ctx) => {
					requireAuth(ctx);
					return ctx.db.transaction(async (tx) => {
						// drizzle-beta .query is broken — use select instead
						const [shift] = await tx
							.select()
							.from(shifts)
							.where(eq(shifts.id, ctx.input.id))
							.limit(1);
						if (!shift) throw httpError.notFound();
						if (shift.status !== "published") {
							throw httpError.conflict("Shift is not published");
						}
						// Block duplicate active requests from the same critter
						const [existing] = await tx
							.select()
							.from(assignments)
							.where(
								and(
									eq(assignments.shiftId, shift.id),
									eq(assignments.critterUserId, ctx.user!.id),
									ne(assignments.status, "withdrawn"),
								),
							)
							.limit(1);
						if (existing) {
							throw httpError.conflict(
								`You already have a ${existing.status} request for this shift`,
							);
						}
						const [created] = await tx
							.insert(assignments)
							.values({
								shiftId: shift.id,
								critterUserId: ctx.user!.id,
								status: "requested",
								requestNote: ctx.input.note,
							})
							.returning();
						await writeHistory(tx, {
							assignmentId: created.id,
							fromStatus: null,
							toStatus: "requested",
							changedBy: ctx.user!.id,
							reason: ctx.input.note,
						});
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
