import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAuth,
	requireCoordinatorOf,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
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

export const Route = createFileRoute("/api/shifts")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({
					from: z.string().datetime().optional(),
					to: z.string().datetime().optional(),
					departmentId: z.string().optional(),
					teamId: z.string().optional(),
					status: z.enum(["draft", "published", "archived"]).optional(),
				}),
				handler: async (ctx) => {
					const conditions = [];
					if (ctx.input.departmentId)
						conditions.push(eq(shifts.departmentId, ctx.input.departmentId));
					if (ctx.input.teamId)
						conditions.push(eq(shifts.teamId, ctx.input.teamId));
					if (ctx.input.from)
						conditions.push(gt(shifts.endsAt, new Date(ctx.input.from)));
					if (ctx.input.to)
						conditions.push(lt(shifts.startsAt, new Date(ctx.input.to)));

					// Any coordinator (of any department) may see drafts — they'll see
					// drafts across every department they coordinate. Non-coordinators
					// are forced to 'published' regardless of what they pass.
					// Note: this doesn't leak other departments' drafts to non-coordinators,
					// because computeTier() per shift still demotes them to 'staffer' or
					// 'public' tier in the projection.
					const isAnyCoordinator = ctx.orgRoles.some(
						(r) => r.role === "admin" || r.role === "owner",
					);
					const statusFilter = isAnyCoordinator
						? (ctx.input.status ?? "published")
						: "published";
					conditions.push(eq(shifts.status, statusFilter));

					const shiftRows = await ctx.db
						.select()
						.from(shifts)
						.where(and(...conditions));

					// Batch-fetch all assignments for the returned shifts in one query
					const shiftIds = shiftRows.map((s) => s.id);
					const assignmentRows = shiftIds.length
						? await ctx.db
								.select()
								.from(assignments)
								.where(inArray(assignments.shiftId, shiftIds))
						: [];
					const assignmentsByShift = new Map<string, typeof assignmentRows>();
					for (const a of assignmentRows) {
						const list = assignmentsByShift.get(a.shiftId) ?? [];
						list.push(a);
						assignmentsByShift.set(a.shiftId, list);
					}

					const projected = await Promise.all(
						shiftRows.map(async (shift) => {
							const tier = computeTier(ctx, shift);
							const shiftAssignments = assignmentsByShift.get(shift.id) ?? [];
							const base = await projectShift(
								shift,
								shiftAssignments,
								tier,
								"UTC",
							);
							// Tag with the requesting user's assignment status so the
							// dashboard can hide the Request button when already
							// requested/approved, and show a status badge.
							if (ctx.user) {
								const userAssignment = shiftAssignments.find(
									(a) =>
										a.critterUserId === ctx.user!.id &&
										a.status !== "withdrawn",
								);
								if (userAssignment) {
									return withAssignmentMeta(base, userAssignment);
								}
							}
							return base;
						}),
					);

					// Emit create/edit FormConfig links based on the user's role, NOT on
					// whether the returned shifts include any coordinator-tier ones.
					// Otherwise an empty department view would never show the "+ New"
					// button (chicken-and-egg).
					const _links = await buildCoordinatorLinks(ctx);

					return {
						events: projected,
						_links,
					};
				},
			}),

			POST: createHandler({
				db,
				input: z.object({
					title: z.string().min(1).max(200),
					description: z.string().max(2000).optional(),
					location: z.string().max(200).optional(),
					start: z.string().datetime(),
					end: z.string().datetime(),
					// Form inputs arrive as strings — coerce so "4" becomes 4.
					capacity: z.coerce.number().int().min(1).max(100),
					departmentId: z.string(),
					teamId: z.string().optional(),
					eventId: z.string().optional(),
					category: z.string().max(64).optional(),
				}),
				handler: async (ctx) => {
					requireCoordinatorOf(ctx, ctx.input.departmentId);
					requireAuth(ctx);
					if (new Date(ctx.input.end) <= new Date(ctx.input.start)) {
						throw httpError.conflict("end must be after start");
					}
					const [row] = await ctx.db
						.insert(shifts)
						.values({
							title: ctx.input.title,
							description: ctx.input.description,
							location: ctx.input.location,
							startsAt: new Date(ctx.input.start),
							endsAt: new Date(ctx.input.end),
							capacity: ctx.input.capacity,
							departmentId: ctx.input.departmentId,
							teamId: ctx.input.teamId,
							eventId: ctx.input.eventId,
							category: ctx.input.category,
							createdBy: ctx.user!.id,
						})
						.returning();
					return projectShift(row, [], "coordinator", "UTC");
				},
			}),
		},
	},
});
