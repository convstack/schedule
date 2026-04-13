import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { boards } from "./boards";

export const boardColumns = pgTable("board_columns", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid()),
	boardId: text("board_id")
		.notNull()
		.references(() => boards.id, { onDelete: "cascade" }),
	label: text("label").notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
