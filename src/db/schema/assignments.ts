import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { shifts } from "./shifts";

export const assignments = pgTable(
	"assignments",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		shiftId: text("shift_id")
			.notNull()
			.references(() => shifts.id, { onDelete: "cascade" }),
		critterUserId: text("critter_user_id").notNull(),
		status: text("status", {
			enum: ["requested", "approved", "declined", "withdrawn"],
		})
			.notNull()
			.default("requested"),
		requestedAt: timestamp("requested_at").defaultNow().notNull(),
		decidedAt: timestamp("decided_at"),
		decidedBy: text("decided_by"),
		declineReason: text("decline_reason"),
		withdrawnAt: timestamp("withdrawn_at"),
		requestNote: text("request_note"),
	},
	(t) => ({
		uniqueActive: uniqueIndex("assignments_unique_active")
			.on(t.shiftId, t.critterUserId)
			.where(sql`${t.status} != 'withdrawn'`),
		shiftIdx: index("assignments_shift_idx").on(t.shiftId),
		userIdx: index("assignments_user_idx").on(t.critterUserId),
		statusIdx: index("assignments_status_idx").on(t.status),
	}),
);
