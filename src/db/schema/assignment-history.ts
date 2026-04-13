import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const assignmentHistory = pgTable("assignment_history", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid()),
	assignmentId: text("assignment_id").notNull(),
	fromStatus: text("from_status"),
	toStatus: text("to_status").notNull(),
	changedBy: text("changed_by").notNull(),
	changedAt: timestamp("changed_at").defaultNow().notNull(),
	reason: text("reason"),
});
