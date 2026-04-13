import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { boardColumns } from "./board-columns";
import { boards } from "./boards";

export const boardCards = pgTable(
	"board_cards",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		columnId: text("column_id")
			.notNull()
			.references(() => boardColumns.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		position: integer("position").notNull().default(0),
		assigneeUserId: text("assignee_user_id"),
		departmentId: text("department_id"),
		teamId: text("team_id"),
		collaboratorUserIds: text("collaborator_user_ids").array(),
		labels: text("labels"), // JSON string of label objects
		priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
			.notNull()
			.default("low"),
		progress: integer("progress"),
		link: text("link"),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		boardIdx: index("board_cards_board_idx").on(t.boardId),
		columnIdx: index("board_cards_column_idx").on(t.columnId),
	}),
);
