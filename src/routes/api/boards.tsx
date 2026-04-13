import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { asc, count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "~/db";
import { boardCards } from "~/db/schema/board-cards";
import { boardColumns } from "~/db/schema/board-columns";
import { boards } from "~/db/schema/boards";

const DEFAULT_COLUMNS = [
	{ label: "To Do", color: "#4f7bff", position: 0 },
	{ label: "In Progress", color: "#f59e0b", position: 1 },
	{ label: "Review", color: "#8b5cf6", position: 2 },
	{ label: "Done", color: "#10b981", position: 3 },
];

export const Route = createFileRoute("/api/boards")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				handler: async (ctx) => {
					const allBoards = await ctx.db
						.select()
						.from(boards)
						.orderBy(asc(boards.createdAt));

					const rows = await Promise.all(
						allBoards.map(async (board) => {
							const [cardCount] = await ctx.db
								.select({ c: count() })
								.from(boardCards)
								.where(eq(boardCards.boardId, board.id));
							const [colCount] = await ctx.db
								.select({ c: count() })
								.from(boardColumns)
								.where(eq(boardColumns.boardId, board.id));
							return {
								id: board.id,
								slug: board.slug,
								title: board.title,
								columns: colCount.c,
								cards: cardCount.c,
								createdAt: board.createdAt.toISOString(),
							};
						}),
					);

					const isCoordinator = ctx.orgRoles.some(
						(r) => r.role === "admin" || r.role === "owner",
					);

					return {
						columns: [
							{ key: "title", label: "Board", sortable: true },
							{ key: "columns", label: "Columns", type: "number" },
							{ key: "cards", label: "Cards", type: "number" },
						],
						rows,
						total: rows.length,
						rowActions: isCoordinator
							? [
									{
										label: "Delete",
										endpoint: "/api/boards/:slug",
										method: "DELETE",
										variant: "danger",
										confirm: "Delete this board and all its cards?",
									},
								]
							: [],
						...(isCoordinator
							? {
									createLink: "/tasks/new",
									createLabel: "New Board",
								}
							: {}),
					};
				},
			}),

			POST: createHandler({
				db,
				input: z.object({
					title: z.string().min(1).max(200),
					slug: z
						.string()
						.min(1)
						.max(100)
						.regex(/^[a-z0-9-]+$/),
				}),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);

					const existing = await ctx.db
						.select()
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (existing.length > 0) {
						throw httpError.conflict("A board with this slug already exists");
					}

					const [board] = await ctx.db
						.insert(boards)
						.values({
							id: nanoid(),
							title: ctx.input.title,
							slug: ctx.input.slug,
							createdBy: ctx.user.id,
						})
						.returning();

					await ctx.db.insert(boardColumns).values(
						DEFAULT_COLUMNS.map((col) => ({
							id: nanoid(),
							boardId: board.id,
							label: col.label,
							color: col.color,
							position: col.position,
						})),
					);

					return {
						success: true,
						redirect: `/tasks/${board.slug}`,
					};
				},
			}),
		},
	},
});
