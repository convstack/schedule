// schedule/src/lib/coordinator-links.ts
// Extracted from shifts-router.ts — reusable across the shifts list + create endpoints.
import type { HandlerContext } from "@convstack/service-sdk/handlers";
import type { Database } from "~/db";

/**
 * Build the create/edit FormConfig + _links block for the shifts list
 * response. Emitted whenever the user has any coordinator role — NOT gated
 * on the returned shift rows (avoids the chicken-and-egg where an empty
 * manage page has no "+ New" button).
 */
export async function buildCoordinatorLinks(context: HandlerContext<Database>) {
	const coordRoles = context.orgRoles.filter(
		(r) => r.role === "admin" || r.role === "owner",
	);
	if (coordRoles.length === 0) return undefined;

	// Resolve department names via cached lanyard lookup. Falls back to the
	// slug from the user's orgRoles entry when the lookup returns null (no
	// service key, network error, not found, etc.) so the dropdown always
	// shows *something* identifiable rather than "Unknown".
	const deptOptions = coordRoles.map((r) => ({
		value: r.orgId,
		label: r.name ?? r.slug ?? r.orgId,
	}));

	const fields = [
		{ key: "title", label: "Title", type: "text" as const, required: true },
		{
			key: "description",
			label: "Description",
			type: "textarea" as const,
		},
		{ key: "location", label: "Location", type: "text" as const },
		{
			key: "start",
			label: "Start",
			type: "datetime" as const,
			required: true,
		},
		{
			key: "end",
			label: "End",
			type: "datetime" as const,
			required: true,
		},
		{
			key: "capacity",
			label: "Capacity",
			type: "number" as const,
			required: true,
		},
		{
			key: "departmentId",
			label: "Department",
			type: "select" as const,
			options: deptOptions,
			required: true,
		},
		{
			key: "category",
			label: "Category (optional)",
			type: "text" as const,
		},
	];

	return {
		create: "/api/shifts",
		createForm: {
			fields,
			submitLabel: "Create shift",
			submitEndpoint: "/api/shifts",
			method: "POST" as const,
		},
		editForm: {
			fields,
			submitLabel: "Save changes",
			submitEndpoint: "/api/shifts",
			method: "PATCH" as const,
		},
	};
}
