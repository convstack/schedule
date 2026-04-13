import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const boards = pgTable("boards", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid()),
	title: text("title").notNull(),
	slug: text("slug").notNull().unique(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
