import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
	id: text("id").primaryKey().default("singleton"),
	conventionName: text("convention_name").notNull().default("Convention"),
	conventionTz: text("convention_tz").notNull().default("UTC"),
	conventionStartsOn: timestamp("convention_starts_on", { withTimezone: true }),
	conventionEndsOn: timestamp("convention_ends_on", { withTimezone: true }),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	updatedBy: text("updated_by"),
});
