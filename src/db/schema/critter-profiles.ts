import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const critterProfiles = pgTable("critter_profiles", {
	userId: text("user_id").primaryKey(),
	shirtSize: text("shirt_size", {
		enum: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
	}),
	dietary: text("dietary"),
	emergencyContact: text("emergency_contact"),
	skills: text("skills").array(),
	availabilityNote: text("availability_note"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
