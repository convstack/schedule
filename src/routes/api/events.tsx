import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { events } from "~/db/schema/events";
export const Route = createFileRoute("/api/events")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({
					from: z.string().datetime().optional(),
					to: z.string().datetime().optional(),
					status: z.enum(["draft", "published", "archived"]).optional(),
				}),
				handler: async (ctx) => {
					const isCoordinator = ctx.orgRoles.some(
						(r) => r.role === "admin" || r.role === "owner",
					);
					const statusFilter = isCoordinator
						? (ctx.input.status ?? "published")
						: "published";

					const conditions = [eq(events.status, statusFilter)];
					if (ctx.input.from)
						conditions.push(gt(events.endsAt, new Date(ctx.input.from)));
					if (ctx.input.to)
						conditions.push(lt(events.startsAt, new Date(ctx.input.to)));

					const rows = await ctx.db
						.select()
						.from(events)
						.where(and(...conditions));

					return {
						events: rows.map((e) => ({
							id: e.id,
							title: e.title,
							description: e.description ?? undefined,
							location: e.location ?? undefined,
							start: e.startsAt.toISOString(),
							end: e.endsAt.toISOString(),
							timezone: "UTC",
							category: e.category ?? undefined,
							status: "scheduled" as const,
							_links: isCoordinator
								? {
										update: `/api/events/${e.id}`,
										delete: `/api/events/${e.id}`,
									}
								: undefined,
						})),
						_links: isCoordinator
							? {
									create: "/api/events",
								}
							: undefined,
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
					category: z.string().max(64).optional(),
				}),
				handler: async (ctx) => {
					requireAuth(ctx);
					requireAnyCoordinator(ctx);
					if (new Date(ctx.input.end) <= new Date(ctx.input.start)) {
						throw httpError.conflict("end must be after start");
					}
					const [row] = await ctx.db
						.insert(events)
						.values({
							title: ctx.input.title,
							description: ctx.input.description,
							location: ctx.input.location,
							startsAt: new Date(ctx.input.start),
							endsAt: new Date(ctx.input.end),
							category: ctx.input.category,
							createdBy: ctx.user!.id,
						})
						.returning();
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
