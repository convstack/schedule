import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const events = pgTable(
	"events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		title: text("title").notNull(),
		description: text("description"),
		location: text("location"),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		category: text("category"),
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		timeIdx: index("events_time_idx").on(t.startsAt, t.endsAt),
		statusIdx: index("events_status_idx").on(t.status),
	}),
);
