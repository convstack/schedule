import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { events } from "./events";

export const shifts = pgTable(
	"shifts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		title: text("title").notNull(),
		description: text("description"),
		location: text("location"),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		capacity: integer("capacity").notNull().default(1),
		departmentId: text("department_id").notNull(),
		teamId: text("team_id"),
		eventId: text("event_id").references(() => events.id, {
			onDelete: "set null",
		}),
		category: text("category"),
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		timeIdx: index("shifts_time_idx").on(t.startsAt, t.endsAt),
		deptIdx: index("shifts_dept_idx").on(t.departmentId),
		statusIdx: index("shifts_status_idx").on(t.status),
	}),
);
