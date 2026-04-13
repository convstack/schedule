import { createHandler } from "@convstack/service-sdk/handlers";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";
import { buildCoordinatorLinks } from "~/lib/coordinator-links";
import {
	computeTier,
	projectShift,
	withAssignmentMeta,
} from "~/lib/visibility";

export const Route = createFileRoute("/api/shifts/mine")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				// OpenAPIHandler passes query params as strings — parse "true"/"false"
				// properly (z.coerce.boolean treats any non-empty string as true, so we
				// can't use it).
				input: z.object({
					past: z
						.union([z.literal("true"), z.literal("false"), z.boolean()])
						.optional()
						.transform((v) => v === true || v === "true"),
				}),
				handler: async (ctx) => {
					requireAuth(ctx);

					const myAssignments = await ctx.db
						.select()
						.from(assignments)
						.where(
							and(
								eq(assignments.critterUserId, ctx.user!.id),
								ne(assignments.status, "withdrawn"),
							),
						);

					if (myAssignments.length === 0) return { events: [] };

					const shiftIds = [...new Set(myAssignments.map((a) => a.shiftId))];
					const shiftConditions = [inArray(shifts.id, shiftIds)];
					const now = new Date();
					if (ctx.input.past) {
						// Past: only shifts that have already ended
						shiftConditions.push(lt(shifts.endsAt, now));
					} else {
						// Upcoming: only shifts that haven't ended yet
						shiftConditions.push(gt(shifts.endsAt, now));
					}

					const shiftRows = await ctx.db
						.select()
						.from(shifts)
						.where(and(...shiftConditions));

					// Map of shiftId -> the user's own assignment for _meta tagging
					const byShift = new Map(myAssignments.map((a) => [a.shiftId, a]));

					const projected = await Promise.all(
						shiftRows.map(async (shift) => {
							const tier = computeTier(ctx, shift);
							// Critters always see their own shifts at at least staffer-level
							const allAssignments = await ctx.db
								.select()
								.from(assignments)
								.where(eq(assignments.shiftId, shift.id));
							const base = await projectShift(
								shift,
								allAssignments,
								tier,
								"UTC",
							);
							// Tag with _meta.assignmentStatus so the dashboard's agenda
							// renderer knows which badge to show.
							return withAssignmentMeta(base, byShift.get(shift.id) ?? null);
						}),
					);

					// Include editForm for coordinators so the Edit modal works
					// on the "My shifts" page too (not just on /shifts).
					const _links = await buildCoordinatorLinks(ctx);

					return { events: projected, _links };
				},
			}),
		},
	},
});
