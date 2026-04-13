import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { critterProfiles } from "~/db/schema/critter-profiles";
import { shifts } from "~/db/schema/shifts";
import { findConflictsForCritter } from "~/lib/conflicts";
import { lookupDepartmentName } from "~/lib/dept-lookup";
import { lookupUserName } from "~/lib/user-lookup";

export const Route = createFileRoute("/api/assignments/queue")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ departmentId: z.string().optional() }),
				handler: async (ctx) => {
					requireAuth(ctx);

					// Determine which departments this user coordinates
					const coordDepts = ctx.orgRoles
						.filter((r) => r.role === "admin" || r.role === "owner")
						.map((r) => r.orgId);

					if (coordDepts.length === 0) {
						throw httpError.forbidden("Coordinator role required");
					}

					// Filter: either the requested dept (if you coord it) or all your depts
					const targetDepts =
						ctx.input.departmentId &&
						coordDepts.includes(ctx.input.departmentId)
							? [ctx.input.departmentId]
							: coordDepts;

					// Fetch all pending assignments whose shift is in a target department
					const rows = await ctx.db
						.select({
							assignmentId: assignments.id,
							shiftId: shifts.id,
							shiftTitle: shifts.title,
							shiftStart: shifts.startsAt,
							shiftEnd: shifts.endsAt,
							shiftLocation: shifts.location,
							shiftCapacity: shifts.capacity,
							shiftDept: shifts.departmentId,
							critterUserId: assignments.critterUserId,
							requestedAt: assignments.requestedAt,
							requestNote: assignments.requestNote,
						})
						.from(assignments)
						.innerJoin(shifts, eq(shifts.id, assignments.shiftId))
						.where(
							and(
								eq(assignments.status, "requested"),
								// `inArray` binds a proper Postgres IN (...) clause; the
								// previous `sql\`= ANY(${array})\`` pattern didn't bind
								// array parameters correctly in drizzle 1.0.0-beta.
								inArray(shifts.departmentId, targetDepts),
							),
						);

					// Enrich each row: critter name, profile, dept name, filledCount, conflicts
					const items = await Promise.all(
						rows.map(async (row) => {
							// drizzle-beta .query is broken — use select instead
							const [critterName, deptName, [profile], filledCountResult] =
								await Promise.all([
									lookupUserName(row.critterUserId),
									lookupDepartmentName(row.shiftDept),
									ctx.db
										.select()
										.from(critterProfiles)
										.where(eq(critterProfiles.userId, row.critterUserId))
										.limit(1),
									ctx.db
										.select({ c: count() })
										.from(assignments)
										.where(
											and(
												eq(assignments.shiftId, row.shiftId),
												eq(assignments.status, "approved"),
											),
										),
								]);

							const conflicts = await findConflictsForCritter(
								row.critterUserId,
								row.shiftStart,
								row.shiftEnd,
								row.assignmentId,
							);

							return {
								id: row.assignmentId,
								shift: {
									id: row.shiftId,
									title: row.shiftTitle,
									start: row.shiftStart.toISOString(),
									end: row.shiftEnd.toISOString(),
									location: row.shiftLocation ?? undefined,
									capacity: row.shiftCapacity,
									filledCount: filledCountResult[0].c,
									departmentId: row.shiftDept,
									// Fall back to the department id if the lanyard name lookup
									// returned null (no service key, 4xx/5xx, etc.).
									departmentName: deptName ?? row.shiftDept,
								},
								critter: {
									userId: row.critterUserId,
									name: critterName,
									hasProfile: !!profile,
									profile: profile
										? {
												shirtSize: profile.shirtSize ?? undefined,
												dietary: profile.dietary ?? undefined,
												skills: profile.skills ?? undefined,
												availabilityNote: profile.availabilityNote ?? undefined,
											}
										: undefined,
								},
								requestedAt: row.requestedAt.toISOString(),
								requestNote: row.requestNote ?? undefined,
								conflicts: conflicts.length > 0 ? conflicts : undefined,
								_links: {
									approve: `/api/assignments/${row.assignmentId}/approve`,
									decline: `/api/assignments/${row.assignmentId}/decline`,
								},
							};
						}),
					);

					return { items, total: items.length };
				},
			}),
		},
	},
});
