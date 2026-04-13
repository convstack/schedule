import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { boardCards } from "./board-cards";

export const boardCardComments = pgTable("board_card_comments", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid()),
	cardId: text("card_id")
		.notNull()
		.references(() => boardCards.id, { onDelete: "cascade" }),
	userId: text("user_id").notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
