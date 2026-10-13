type Row = Record<string, unknown>;
type Ctx = Record<string, Row>;
type Pred = (ctx: Ctx) => boolean;
type Column = { __col: true; table: string; name: string };
type Table = { __table: string };
type Order = { column: Column; dir: 1 | -1 };

export const tables: Record<string, Row[]> = {};

// writes[] records every row an update touched; failUpdate makes the nth one throw
export const writes: Array<{ table: string; id: unknown }> = [];
export const faults: { failUpdate: number | null } = { failUpdate: null };
let updates = 0;
let inserted = 0;

function replaceTables(data: Record<string, Row[]>) {
	for (const name of Object.keys(tables)) delete tables[name];
	for (const [name, rows] of Object.entries(data)) {
		tables[name] = rows.map((r) => ({ ...r }));
	}
}

export function seed(data: Record<string, Row[]>) {
	writes.length = 0;
	faults.failUpdate = null;
	updates = 0;
	replaceTables(data);
}

const isColumn = (x: unknown): x is Column =>
	typeof x === "object" && x !== null && "__col" in x;
const isTable = (x: unknown): x is Table =>
	typeof x === "object" && x !== null && "__table" in x;

// a column the fake doesn't know would read as undefined and pass every negative test
const table = (name: string, columns: string[]) =>
	new Proxy(
		{
			__table: name,
			...Object.fromEntries(
				columns.map((c) => [c, { __col: true, table: name, name: c }]),
			),
		} as Record<string, unknown>,
		{
			get(target, prop, receiver) {
				if (typeof prop === "string" && !(prop in target) && prop !== "then") {
					throw new Error(`fake schema has no column ${name}.${prop}`);
				}
				return Reflect.get(target, prop, receiver);
			},
		},
	);

export const schemaModules = {
	"~/db/schema/boards": {
		boards: table("boards", ["id", "title", "slug", "createdBy"]),
	},
	"~/db/schema/board-columns": {
		boardColumns: table("boardColumns", ["id", "boardId", "label", "position"]),
	},
	"~/db/schema/board-cards": {
		boardCards: table("boardCards", [
			"id",
			"boardId",
			"columnId",
			"title",
			"position",
			"departmentId",
			"updatedAt",
		]),
	},
	"~/db/schema/board-card-comments": {
		boardCardComments: table("boardCardComments", [
			"id",
			"cardId",
			"userId",
			"content",
			"createdAt",
		]),
	},
	"~/db/schema/events": {
		events: table("events", ["id", "title", "status"]),
	},
	"~/db/schema/shifts": {
		shifts: table("shifts", ["id", "title", "status", "departmentId"]),
	},
	"~/db/schema/assignments": {
		assignments: table("assignments", ["id", "shiftId"]),
	},
};

const read = (x: unknown, ctx: Ctx) =>
	isColumn(x) ? ctx[x.table]?.[x.name] : x;

export const drizzleModule = {
	eq:
		(a: unknown, b: unknown): Pred =>
		(ctx) => {
			const left = read(a, ctx);
			const right = read(b, ctx);
			// SQL never matches a missing value
			return left != null && left === right;
		},
	and:
		(...preds: Array<Pred | undefined>): Pred =>
		(ctx) =>
			preds.every((p) => !p || p(ctx)),
	asc: (column: Column): Order => ({ column, dir: 1 }),
	desc: (column: Column): Order => ({ column, dir: -1 }),
	count: () => "count",
};

function project(ctxs: Ctx[], projection?: Record<string, unknown>) {
	return ctxs.map((ctx) => {
		if (!projection) {
			const names = Object.keys(ctx);
			return names.length === 1 ? ctx[names[0]] : ctx;
		}
		return Object.fromEntries(
			Object.entries(projection).map(([key, value]) => [
				key,
				isTable(value) ? ctx[value.__table] : read(value, ctx),
			]),
		);
	});
}

function query(ctxs: Ctx[], projection?: Record<string, unknown>) {
	return Object.assign(Promise.resolve(project(ctxs, projection)), {
		innerJoin: (t: Table, on: Pred) =>
			query(
				ctxs.flatMap((ctx) =>
					(tables[t.__table] ?? [])
						.map((row) => ({ ...ctx, [t.__table]: row }))
						.filter(on),
				),
				projection,
			),
		where: (pred: Pred) => query(ctxs.filter(pred), projection),
		// ties keep insertion order; Postgres promises nothing for them
		orderBy: (...orders: Order[]) =>
			query(
				[...ctxs].sort((a, b) => {
					for (const { column, dir } of orders) {
						const x = read(column, a) as number;
						const y = read(column, b) as number;
						if (x !== y) return (x < y ? -1 : 1) * dir;
					}
					return 0;
				}),
				projection,
			),
		limit: (n: number) => query(ctxs.slice(0, n), projection),
	});
}

export const db = {
	select: (projection?: Record<string, unknown>) => ({
		from: (t: Table) =>
			query(
				(tables[t.__table] ?? []).map((row) => ({ [t.__table]: row })),
				projection,
			),
	}),
	insert: (t: Table) => ({
		values: (values: Row) => {
			const rows = tables[t.__table] ?? [];
			const row = {
				id: `new-${++inserted}`,
				createdAt: new Date(),
				...values,
			};
			tables[t.__table] = [...rows, row];
			return Object.assign(Promise.resolve(undefined), {
				returning: async () => [row],
			});
		},
	}),
	update: (t: Table) => ({
		set: (values: Row) => ({
			where: async (pred: Pred) => {
				if (++updates === faults.failUpdate) throw new Error("write failed");
				for (const row of tables[t.__table] ?? []) {
					if (pred({ [t.__table]: row })) {
						Object.assign(row, values);
						writes.push({ table: t.__table, id: row.id });
					}
				}
			},
		}),
	}),
	delete: (t: Table) => ({
		where: async (pred: Pred) => {
			tables[t.__table] = (tables[t.__table] ?? []).filter(
				(row) => !pred({ [t.__table]: row }),
			);
		},
	}),
	// like Postgres: a failure inside puts everything back
	transaction: async <T>(run: (tx: object) => Promise<T>) => {
		const before = Object.fromEntries(
			Object.entries(tables).map(([name, rows]) => [
				name,
				rows.map((r) => ({ ...r })),
			]),
		);
		try {
			return await run(db);
		} catch (err) {
			replaceTables(before);
			throw err;
		}
	},
};
