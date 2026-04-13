import type { HandlerContext } from "@convstack/service-sdk/handlers";
import { lookupManyUserNames } from "./user-lookup";

export type VisibilityTier = "public" | "staffer" | "coordinator";

interface ShiftLike {
	id: string;
	departmentId: string;
	title: string;
	startsAt: Date;
	endsAt: Date;
	location: string | null;
	category: string | null;
	capacity: number;
	status: "draft" | "published" | "archived";
}

interface AssignmentLike {
	id: string;
	shiftId: string;
	critterUserId: string;
	status: "requested" | "approved" | "declined" | "withdrawn";
	requestedAt: Date;
	decidedAt: Date | null;
}

export function computeTier(
	context: Pick<HandlerContext, "user" | "orgRoles">,
	shift: ShiftLike,
): VisibilityTier {
	if (!context.user) return "public";
	const role = context.orgRoles.find((r) => r.orgId === shift.departmentId);
	if (role && (role.role === "admin" || role.role === "owner")) {
		return "coordinator";
	}
	if (context.orgRoles.length > 0) return "staffer";
	return "public";
}

export interface ProjectedShift {
	id: string;
	title: string;
	start: string;
	end: string;
	timezone: string;
	location?: string;
	category?: string;
	capacity: number;
	filledCount: number;
	requestedCount: number;
	assignments?: Array<{
		id: string;
		critterUserId: string;
		critterName: string;
		status: AssignmentLike["status"];
		requestedAt: string;
		_links?: { approve?: string; decline?: string };
	}>;
	_links?: {
		update?: string;
		delete?: string;
		request?: string;
		publish?: string;
		archive?: string;
	};
	_meta?: { assignmentStatus?: AssignmentLike["status"] };
}

export async function projectShift(
	shift: ShiftLike,
	assignments: AssignmentLike[],
	tier: VisibilityTier,
	timezone: string,
): Promise<ProjectedShift> {
	const filledCount = assignments.filter((a) => a.status === "approved").length;
	const requestedCount = assignments.filter(
		(a) => a.status === "requested",
	).length;

	const base: ProjectedShift = {
		id: shift.id,
		title: shift.title,
		start: shift.startsAt.toISOString(),
		end: shift.endsAt.toISOString(),
		timezone,
		location: shift.location ?? undefined,
		category: shift.category ?? undefined,
		capacity: shift.capacity,
		filledCount,
		requestedCount,
	};

	if (tier === "public") return base;

	// Staffer or coordinator: include the roster.
	const visibleAssignments = assignments.filter(
		(a) => a.status !== "withdrawn",
	);
	const names = await lookupManyUserNames(
		visibleAssignments.map((a) => a.critterUserId),
	);

	base.assignments = visibleAssignments.map((a) => ({
		id: a.id,
		critterUserId: a.critterUserId,
		critterName: names.get(a.critterUserId) ?? "Unknown",
		status: a.status,
		requestedAt: a.requestedAt.toISOString(),
		_links:
			tier === "coordinator" && a.status === "requested"
				? {
						approve: `/api/assignments/${a.id}/approve`,
						decline: `/api/assignments/${a.id}/decline`,
					}
				: undefined,
	}));

	if (tier === "coordinator") {
		base._links = {
			update: `/api/shifts/${shift.id}`,
			delete: `/api/shifts/${shift.id}`,
			// Lifecycle transitions — only emit the link that's valid for the
			// current status. Drafts can be published; published shifts can be
			// archived; archived is terminal.
			publish:
				shift.status === "draft"
					? `/api/shifts/${shift.id}/publish`
					: undefined,
			archive:
				shift.status === "published"
					? `/api/shifts/${shift.id}/archive`
					: undefined,
		};
	}

	// Anyone can request published shifts — coordinators too (they might
	// want to volunteer for shifts in other departments, or even their own).
	if (shift.status === "published") {
		base._links = {
			...(base._links ?? {}),
			request: `/api/shifts/${shift.id}/request`,
		};
	}

	return base;
}

export function withAssignmentMeta(
	projected: ProjectedShift,
	userAssignment: AssignmentLike | null,
): ProjectedShift {
	if (!userAssignment) return projected;
	return {
		...projected,
		_meta: { assignmentStatus: userAssignment.status },
	};
}
