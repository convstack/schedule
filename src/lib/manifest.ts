import {
	agenda,
	approvalQueue,
	calendarDay,
	calendarGrid,
	coordinatorItem,
	dataTable,
	defineManifest,
	form,
	item,
	kanban,
	page,
	selectField,
	sidebar,
	tabs,
	textareaField,
	textField,
	upcomingStrip,
} from "@convstack/service-sdk/manifest";

export const SCHEDULE_MANIFEST = defineManifest({
	name: "Schedule",
	slug: "schedule",
	icon: "calendar",
	accent: "#10b981",
	navigation: [{ label: "Schedule", path: "/", icon: "calendar" }],
	sidebar: sidebar({
		items: [
			item("What's on", "/", { icon: "calendar" }),
			item("Shifts", "/shifts", { icon: "clipboard-list" }),
			item("My shifts", "/my", { icon: "user-check" }),
			coordinatorItem("Approval queue", "/queue", { icon: "inbox" }),
			coordinatorItem("Manage shifts", "/manage", { icon: "settings" }),
			coordinatorItem("Tasks", "/tasks", { icon: "kanban-square" }),
		],
		primaryAction: { label: "Browse shifts", icon: "search", link: "/shifts" },
		footerItems: [item("My profile", "/profile", { icon: "user" })],
	}),
	pages: [
		// Page 1 — What's on (public events schedule)
		page("/", "What's on", { layout: "wide" }, [
			upcomingStrip("/api/events", { title: "Coming up", maxItems: 5 }),
			tabs({
				default: "grid",
				tabs: [
					{
						key: "grid",
						label: "By track",
						icon: "columns",
						sections: [calendarGrid("/api/events", { hourRange: [9, 23] })],
					},
					{
						key: "day",
						label: "By day",
						icon: "clock",
						sections: [calendarDay("/api/events", { hourRange: [9, 23] })],
					},
					{
						key: "agenda",
						label: "Agenda",
						icon: "list",
						sections: [agenda("/api/events", { groupBy: "day" })],
					},
				],
			}),
		]),

		// Page 2 — Shifts (browse shifts to request)
		// Shifts don't have tracks/rooms, so we use agenda + day views
		// (no calendar-grid — it needs tracks to render columns).
		page("/shifts", "Shifts", { layout: "wide" }, [
			tabs({
				default: "agenda",
				tabs: [
					{
						key: "agenda",
						label: "Agenda",
						icon: "list",
						sections: [agenda("/api/shifts", { groupBy: "day" })],
					},
					{
						key: "day",
						label: "Day",
						icon: "clock",
						sections: [calendarDay("/api/shifts", { hourRange: [0, 24] })],
					},
				],
			}),
		]),

		// Page 3 — My shifts
		page("/my", "My shifts", { layout: "wide" }, [
			agenda("/api/shifts/mine", {
				title: "Upcoming",
				groupBy: "day",
				showPastEvents: false,
				emptyState: {
					title: "No shifts yet",
					description:
						"Browse the schedule and request a shift to start volunteering.",
					action: { label: "Browse shifts", link: "/shifts" },
				},
			}),
			agenda("/api/shifts/mine?past=true", {
				title: "Past shifts",
				groupBy: "day",
				showPastEvents: true,
			}),
		]),

		// Page 4 — Approval queue (coordinator only)
		page("/queue", "Approval queue", { layout: "default" }, [
			approvalQueue("/api/assignments/queue", {
				title: "Pending requests",
				emptyState: {
					title: "All caught up",
					description: "No pending requests right now.",
				},
			}),
		]),

		// Page 5 — Manage shifts (coordinator only)
		// Uses `agenda` instead of `calendar-grid` because shifts don't have
		// tracks/rooms by default — a multi-track grid view has no columns to
		// render into and shifts disappear. Agenda is the universal fallback
		// that works with any shift regardless of team/track assignment.
		page("/manage", "Manage shifts", { layout: "wide" }, [
			agenda("/api/shifts?status=draft", {
				title: "Drafts",
				groupBy: "day",
				showPastEvents: true,
				emptyState: {
					title: "No draft shifts",
					description:
						'Click "+ New shift" on the published section below to create one.',
				},
			}),
			agenda("/api/shifts", {
				title: "Published shifts",
				groupBy: "day",
				showPastEvents: true,
				emptyState: {
					title: "No published shifts yet",
					description:
						"Create a shift here, then publish it from its popover to make it visible to critters.",
				},
			}),
		]),

		// Page 6 — Tasks (board listing)
		page("/tasks", "Boards", { layout: "default" }, [
			dataTable("/api/boards", {
				title: "Task Boards",
				rowLink: "/tasks/:slug",
			}),
		]),

		// Page 7 — Individual board (dynamic by slug)
		page("/tasks/:slug", "Board", { layout: "wide" }, [
			kanban("/api/boards/:slug"),
		]),

		// Page 8 — Create new board
		page("/tasks/new", "New Board", { layout: "default", showBack: true }, [
			form("/api/boards", {
				title: "Create a new board",
				submitEndpoint: "/api/boards",
				submitLabel: "Create Board",
				method: "POST",
				fields: [
					textField("title", "Board name", { required: true }),
					textField("slug", "Slug (URL-safe, e.g. convention-prep)", {
						required: true,
					}),
				],
			}),
		]),

		// Page 7 — My profile
		page("/profile", "My profile", { layout: "default" }, [
			form("/api/critter/profile", {
				title: "Volunteer details",
				submitEndpoint: "/api/critter/profile",
				submitLabel: "Save",
				method: "PUT",
				fields: [
					selectField("shirtSize", "T-shirt size", [
						{ label: "XS", value: "xs" },
						{ label: "S", value: "s" },
						{ label: "M", value: "m" },
						{ label: "L", value: "l" },
						{ label: "XL", value: "xl" },
						{ label: "2XL", value: "2xl" },
						{ label: "3XL", value: "3xl" },
					]),
					textareaField("dietary", "Dietary needs"),
					textField("emergencyContact", "Emergency contact"),
					textField("skills", "Skills (comma-separated)"),
					textareaField("availabilityNote", "Availability notes"),
				],
			}),
		]),
	],
	permissions: [
		// Department coordinator permission is computed from org roles
		// (`admin`/`owner` in the shift's department), NOT from this list —
		// that's a per-department gate that can't be modeled as a flat
		// service-wide permission string.
	],
});
