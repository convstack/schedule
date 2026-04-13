// schedule/src/lib/audit.ts
import { nanoid } from "nanoid";
import type { Database } from "~/db";
import { assignmentHistory } from "~/db/schema/assignment-history";

export interface AuditTransition {
	assignmentId: string;
	fromStatus: string | null;
	toStatus: string;
	changedBy: string;
	reason?: string;
}

// Call with a drizzle transaction (or the root db). Both work because
// drizzle transactions expose the same insert() API.
export async function writeHistory(
	tx: Pick<Database, "insert">,
	transition: AuditTransition,
): Promise<void> {
	await tx.insert(assignmentHistory).values({
		id: nanoid(),
		assignmentId: transition.assignmentId,
		fromStatus: transition.fromStatus,
		toStatus: transition.toStatus,
		changedBy: transition.changedBy,
		reason: transition.reason ?? null,
	});
}
