// schedule/src/lib/conflicts.ts
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "~/db";
import { assignments } from "~/db/schema/assignments";
import { shifts } from "~/db/schema/shifts";

export interface Conflict {
	shiftId: string;
	title: string;
	start: string;
	end: string;
	status: "requested" | "approved";
}

/**
 * Returns conflicts for a specific critter user within a given time range,
 * excluding a specific assignment (the one being examined). Used by the
 * approval queue to surface overlaps at review time.
 */
export async function findConflictsForCritter(
	critterUserId: string,
	start: Date,
	end: Date,
	excludeAssignmentId?: string,
): Promise<Conflict[]> {
	const rows = await db
		.select({
			shiftId: shifts.id,
			title: shifts.title,
			start: shifts.startsAt,
			end: shifts.endsAt,
			assignmentId: assignments.id,
			assignmentStatus: assignments.status,
		})
		.from(assignments)
		.innerJoin(shifts, eq(shifts.id, assignments.shiftId))
		.where(
			and(
				eq(assignments.critterUserId, critterUserId),
				sql`${assignments.status} IN ('requested', 'approved')`,
				lt(shifts.startsAt, end),
				gt(shifts.endsAt, start),
				excludeAssignmentId
					? ne(assignments.id, excludeAssignmentId)
					: undefined,
			),
		);

	return rows.map((r) => ({
		shiftId: r.shiftId,
		title: r.title,
		start: r.start.toISOString(),
		end: r.end.toISOString(),
		status: r.assignmentStatus as "requested" | "approved",
	}));
}
