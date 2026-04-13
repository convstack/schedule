import { createHandler, httpError } from "@convstack/service-sdk/handlers";
import {
	requireAnyCoordinator,
	requireAuth,
} from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { boardCards } from "~/db/schema/board-cards";
import { boardColumns } from "~/db/schema/board-columns";
import { boards } from "~/db/schema/boards";
import { lookupDepartmentName } from "~/lib/dept-lookup";
import { lookupManyUserNames } from "~/lib/user-lookup";

export const Route = createFileRoute("/api/boards/$slug")({
	server: {
		handlers: {
			GET: createHandler({
				db,
				input: z.object({ slug: z.string() }),
				handler: async (ctx) => {
					const [board] = await ctx.db
						.select()
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (!board) throw httpError.notFound("Board not found");

					const columns = await ctx.db
						.select()
						.from(boardColumns)
						.where(eq(boardColumns.boardId, board.id))
						.orderBy(asc(boardColumns.position));

					const cards = await ctx.db
						.select()
						.from(boardCards)
						.where(eq(boardCards.boardId, board.id))
						.orderBy(asc(boardCards.position));

					const allUserIds = new Set<string>();
					for (const card of cards) {
						if (card.assigneeUserId) allUserIds.add(card.assigneeUserId);
						if (card.collaboratorUserIds) {
							for (const id of card.collaboratorUserIds) allUserIds.add(id);
						}
					}
					const userNames = await lookupManyUserNames([...allUserIds]);

					const deptIds = new Set<string>();
					for (const card of cards) {
						if (card.departmentId) deptIds.add(card.departmentId);
					}
					const deptNames = new Map<string, string>();
					await Promise.all(
						[...deptIds].map(async (id) => {
							const name = await lookupDepartmentName(id);
							if (name) deptNames.set(id, name);
						}),
					);

					const isAnyCoordinator = ctx.orgRoles.some(
						(r) => r.role === "admin" || r.role === "owner",
					);

					let deptNameFallback = new Map<string, string>();
					let deptOptions: Array<{ value: string; label: string }> = [];
					const departmentTeams: Record<
						string,
						Array<{ id: string; name: string }>
					> = {};
					const departmentMembers: Record<
						string,
						Array<{ id: string; name: string; userId: string }>
					> = {};

					if (isAnyCoordinator) {
						const coordRoles = ctx.orgRoles.filter(
							(r) => r.role === "admin" || r.role === "owner",
						);
						deptOptions = coordRoles.map((r) => ({
							value: r.orgId,
							label: r.name ?? r.slug ?? r.orgId,
						}));
						deptNameFallback = new Map(
							deptOptions.map((o) => [o.value, o.label]),
						);

						const LANYARD_URL =
							process.env.LANYARD_URL || "http://localhost:3000";
						const SERVICE_KEY = process.env.LANYARD_SERVICE_KEY;

						if (SERVICE_KEY) {
							await Promise.all(
								coordRoles.map(async (r) => {
									const res = await fetch(
										`${LANYARD_URL}/api/services/departments/${r.orgId}`,
										{ headers: { Authorization: `ServiceKey ${SERVICE_KEY}` } },
									).catch(() => null);

									if (res?.ok) {
										const d = await res.json().catch(() => null);
										if (d?.teams) departmentTeams[r.orgId] = d.teams;
										if (d?.members) departmentMembers[r.orgId] = d.members;
									}
								}),
							);
						}
					}

					const projectedCards = cards.map((card) => {
						const canEdit =
							isAnyCoordinator &&
							(!card.departmentId ||
								ctx.orgRoles.some(
									(r) =>
										r.orgId === card.departmentId &&
										(r.role === "admin" || r.role === "owner"),
								));

						const labels = card.labels
							? (() => {
									try {
										return JSON.parse(card.labels) as Array<{
											text: string;
											color?: string;
										}>;
									} catch {
										return undefined;
									}
								})()
							: undefined;

						return {
							id: card.id,
							title: card.title,
							description: card.description ?? undefined,
							columnId: card.columnId,
							position: card.position,
							labels,
							assignee: card.assigneeUserId
								? { name: userNames.get(card.assigneeUserId) ?? "Unknown" }
								: undefined,
							department: card.departmentId
								? {
										id: card.departmentId,
										name:
											deptNames.get(card.departmentId) ??
											deptNameFallback.get(card.departmentId) ??
											card.departmentId,
										teamId: card.teamId ?? undefined,
									}
								: undefined,
							collaborators: card.collaboratorUserIds?.map((id) => ({
								userId: id,
								name: userNames.get(id) ?? "Unknown",
							})),
							priority: card.priority ?? undefined,
							progress: card.progress ?? undefined,
							link: card.link ?? undefined,
							_links: canEdit
								? {
										update: `/api/boards/${ctx.input.slug}/cards/${card.id}`,
										delete: `/api/boards/${ctx.input.slug}/cards/${card.id}`,
									}
								: undefined,
						};
					});

					let topLinks:
						| {
								create?: string;
								createForm?: object;
								editForm?: object;
								reorderColumns?: string;
								addColumn?: string;
						  }
						| undefined;

					if (isAnyCoordinator) {
						const columnOptions = columns.map((c) => ({
							value: c.id,
							label: c.label,
						}));

						const formFields = [
							{
								key: "title",
								label: "Title",
								type: "text" as const,
								required: true,
							},
							{
								key: "description",
								label: "Description",
								type: "textarea" as const,
							},
							{
								key: "priority",
								label: "Priority",
								type: "select" as const,
								options: [
									{ value: "low", label: "Low" },
									{ value: "medium", label: "Medium" },
									{ value: "high", label: "High" },
									{ value: "urgent", label: "Urgent" },
								],
							},
							{
								key: "departmentId",
								label: "Department",
								type: "select" as const,
								options: deptOptions,
							},
							{
								key: "columnId",
								label: "Column",
								type: "select" as const,
								options: columnOptions,
								required: true,
							},
						];

						topLinks = {
							create: `/api/boards/${ctx.input.slug}`,
							createForm: {
								fields: formFields,
								submitLabel: "Create card",
								submitEndpoint: `/api/boards/${ctx.input.slug}`,
								method: "POST" as const,
							},
							editForm: {
								fields: formFields,
								submitLabel: "Save changes",
								submitEndpoint: `/api/boards/${ctx.input.slug}/cards`,
								method: "PATCH" as const,
							},
							reorderColumns: `/api/boards/${ctx.input.slug}/columns/reorder`,
							addColumn: `/api/boards/${ctx.input.slug}/columns`,
						};
					}

					return {
						slug: ctx.input.slug,
						columns: columns.map((c) => ({
							id: c.id,
							label: c.label,
							color: c.color ?? undefined,
							position: c.position,
						})),
						cards: projectedCards,
						_links: topLinks,
						_meta: isAnyCoordinator
							? { departmentTeams, departmentMembers }
							: undefined,
					};
				},
			}),

			POST: createHandler({
				db,
				input: z.object({
					slug: z.string(),
					title: z.string().min(1).max(200),
					description: z.string().max(2000).optional(),
					columnId: z.string().min(1),
					priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
					departmentId: z.string().optional(),
					assigneeUserId: z.string().optional(),
					labels: z.string().optional(), // JSON string
				}),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);

					const [board] = await ctx.db
						.select()
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (!board) throw httpError.notFound("Board not found");

					const [column] = await ctx.db
						.select()
						.from(boardColumns)
						.where(eq(boardColumns.id, ctx.input.columnId))
						.limit(1);
					if (!column || column.boardId !== board.id) {
						throw httpError.badRequest("Column not found on this board");
					}

					// New card goes at the end of the column.
					const [{ value: cardCount }] = await ctx.db
						.select({ value: count() })
						.from(boardCards)
						.where(eq(boardCards.columnId, ctx.input.columnId));

					const [card] = await ctx.db
						.insert(boardCards)
						.values({
							boardId: board.id,
							columnId: ctx.input.columnId,
							title: ctx.input.title,
							description: ctx.input.description,
							position: cardCount,
							priority: ctx.input.priority,
							departmentId: ctx.input.departmentId,
							assigneeUserId: ctx.input.assigneeUserId,
							labels: ctx.input.labels,
							createdBy: ctx.user!.id,
						})
						.returning();

					return {
						id: card.id,
						title: card.title,
						description: card.description ?? undefined,
						columnId: card.columnId,
						position: card.position,
						priority: card.priority ?? undefined,
						_links: {
							update: `/api/boards/${ctx.input.slug}/cards/${card.id}`,
							delete: `/api/boards/${ctx.input.slug}/cards/${card.id}`,
						},
					};
				},
			}),

			DELETE: createHandler({
				db,
				input: z.object({ slug: z.string() }),
				handler: async (ctx) => {
					requireAnyCoordinator(ctx);
					requireAuth(ctx);
					const [board] = await ctx.db
						.select()
						.from(boards)
						.where(eq(boards.slug, ctx.input.slug))
						.limit(1);
					if (!board) throw httpError.notFound("Board not found");
					await ctx.db.delete(boards).where(eq(boards.id, board.id));
					return { ok: true as const };
				},
			}),
		},
	},
});
