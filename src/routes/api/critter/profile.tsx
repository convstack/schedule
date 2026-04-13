import { createHandler } from "@convstack/service-sdk/handlers";
import { critterProfileSchema } from "@convstack/service-sdk/manifest-schema";
import { requireAuth } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { critterProfiles } from "~/db/schema/critter-profiles";

export const Route = createFileRoute("/api/critter/profile")({
	server: {
		handlers: {
			// GET /api/critter/profile — returns the authenticated critter's profile or null
			GET: createHandler({
				db,
				handler: async (ctx) => {
					requireAuth(ctx);
					// drizzle-beta .query is broken — use select instead
					const [row] = await ctx.db
						.select()
						.from(critterProfiles)
						.where(eq(critterProfiles.userId, ctx.user!.id))
						.limit(1);
					if (!row) return null;
					return {
						userId: row.userId,
						shirtSize: row.shirtSize ?? undefined,
						dietary: row.dietary ?? undefined,
						emergencyContact: row.emergencyContact ?? undefined,
						skills: row.skills ?? undefined,
						availabilityNote: row.availabilityNote ?? undefined,
					};
				},
			}),

			// PUT /api/critter/profile — inserts or updates the profile row for the authenticated user
			PUT: createHandler({
				db,
				input: critterProfileSchema,
				handler: async (ctx) => {
					requireAuth(ctx);
					const values = {
						userId: ctx.user!.id,
						shirtSize: ctx.input.shirtSize,
						dietary: ctx.input.dietary,
						emergencyContact: ctx.input.emergencyContact,
						skills: ctx.input.skills,
						availabilityNote: ctx.input.availabilityNote,
						updatedAt: new Date(),
					};
					await ctx.db
						.insert(critterProfiles)
						.values(values)
						.onConflictDoUpdate({
							target: critterProfiles.userId,
							set: values,
						});
					return { ...ctx.input, userId: ctx.user!.id };
				},
			}),
		},
	},
});
