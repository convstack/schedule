import { sql } from "drizzle-orm";
import { db } from ".";
import { assignments } from "./schema/assignments";
import { boardCards } from "./schema/board-cards";
import { boardColumns } from "./schema/board-columns";
import { boards } from "./schema/boards";
import { events } from "./schema/events";
import { shifts } from "./schema/shifts";

// Placeholder lanyard IDs — in a real setup you'd generate these by
// creating test users and departments in lanyard first. For now, these
// are opaque strings that lanyard's service-key user lookup will return
// "Unknown" for, which is acceptable for visual smoke testing.
const DEPT_IT = "dept_it_test";
const DEPT_SECURITY = "dept_security_test";
const DEPT_REGISTRATION = "dept_registration_test";

const USER_ALICE = "user_alice_test";
const USER_BOB = "user_bob_test";
const USER_CARLA = "user_carla_test";
const USER_DAN = "user_dan_test";
const USER_EVE = "user_eve_test";

function daysFromNow(days: number, hours = 0, minutes = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() + days);
	d.setHours(hours, minutes, 0, 0);
	return d;
}

async function main() {
	console.log("[schedule:seed] truncating existing data");
	await db.execute(
		sql`TRUNCATE assignment_history, assignments, shifts, events CASCADE`,
	);

	console.log("[schedule:seed] inserting events");
	const eventRows = await db
		.insert(events)
		.values([
			{
				title: "Opening Ceremony",
				location: "Main Stage",
				startsAt: daysFromNow(1, 10),
				endsAt: daysFromNow(1, 11),
				category: "Ceremony",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Cosplay Q&A",
				location: "Panel Room A",
				startsAt: daysFromNow(1, 13),
				endsAt: daysFromNow(1, 14),
				category: "Panel",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Headliner Concert",
				location: "Main Stage",
				startsAt: daysFromNow(2, 20),
				endsAt: daysFromNow(2, 22),
				category: "Performance",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Artist Meet & Greet",
				location: "Artist Alley",
				startsAt: daysFromNow(2, 14),
				endsAt: daysFromNow(2, 16),
				category: "Social",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Closing Ceremony",
				location: "Main Stage",
				startsAt: daysFromNow(3, 17),
				endsAt: daysFromNow(3, 18),
				category: "Ceremony",
				status: "published",
				createdBy: USER_ALICE,
			},
		])
		.returning();

	console.log("[schedule:seed] inserting shifts");
	const shiftRows = await db
		.insert(shifts)
		.values([
			{
				title: "Registration desk — morning",
				location: "Main entrance",
				startsAt: daysFromNow(1, 8),
				endsAt: daysFromNow(1, 12),
				capacity: 4,
				departmentId: DEPT_REGISTRATION,
				category: "Registration",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Registration desk — afternoon",
				location: "Main entrance",
				startsAt: daysFromNow(1, 12),
				endsAt: daysFromNow(1, 17),
				capacity: 4,
				departmentId: DEPT_REGISTRATION,
				category: "Registration",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Main stage security — ceremony",
				location: "Main Stage",
				startsAt: daysFromNow(1, 9, 30),
				endsAt: daysFromNow(1, 11, 30),
				capacity: 3,
				departmentId: DEPT_SECURITY,
				eventId: eventRows[0].id,
				category: "Security",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Main stage security — concert",
				location: "Main Stage",
				startsAt: daysFromNow(2, 19),
				endsAt: daysFromNow(2, 23),
				capacity: 6,
				departmentId: DEPT_SECURITY,
				eventId: eventRows[2].id,
				category: "Security",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "IT helpdesk — day 1",
				location: "Room 204",
				startsAt: daysFromNow(1, 9),
				endsAt: daysFromNow(1, 18),
				capacity: 2,
				departmentId: DEPT_IT,
				category: "Support",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "IT helpdesk — day 2",
				location: "Room 204",
				startsAt: daysFromNow(2, 9),
				endsAt: daysFromNow(2, 18),
				capacity: 2,
				departmentId: DEPT_IT,
				category: "Support",
				status: "published",
				createdBy: USER_ALICE,
			},
			{
				title: "Registration desk — day 2",
				location: "Main entrance",
				startsAt: daysFromNow(2, 9),
				endsAt: daysFromNow(2, 17),
				capacity: 3,
				departmentId: DEPT_REGISTRATION,
				category: "Registration",
				status: "published",
				createdBy: USER_ALICE,
			},
		])
		.returning();

	console.log("[schedule:seed] inserting assignments");
	// Mix of requested / approved / withdrawn for realistic tier testing
	await db.insert(assignments).values([
		{
			shiftId: shiftRows[0].id,
			critterUserId: USER_BOB,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[0].id,
			critterUserId: USER_CARLA,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[0].id,
			critterUserId: USER_DAN,
			status: "requested",
			requestNote: "I have retail experience and can handle the morning rush.",
		},
		{
			shiftId: shiftRows[1].id,
			critterUserId: USER_BOB,
			status: "requested",
		},
		{
			shiftId: shiftRows[2].id,
			critterUserId: USER_EVE,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[3].id,
			critterUserId: USER_CARLA,
			status: "requested",
			requestNote: "I've done crowd work at two cons before.",
		},
		{
			shiftId: shiftRows[3].id,
			critterUserId: USER_DAN,
			status: "requested",
		},
		{
			shiftId: shiftRows[4].id,
			critterUserId: USER_BOB,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[5].id,
			critterUserId: USER_EVE,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[6].id,
			critterUserId: USER_CARLA,
			status: "approved",
			decidedAt: new Date(),
			decidedBy: USER_ALICE,
		},
		{
			shiftId: shiftRows[6].id,
			critterUserId: USER_DAN,
			status: "withdrawn",
			withdrawnAt: new Date(),
		},
	]);

	// ── Kanban boards ────────────────────────────────────────────────────────
	console.log("[schedule:seed] truncating board data");
	await db.execute(sql`TRUNCATE board_cards, board_columns, boards CASCADE`);

	console.log("[schedule:seed] inserting kanban board");
	const [prepBoard] = await db
		.insert(boards)
		.values({
			title: "Convention Prep",
			slug: "convention-prep",
			createdBy: USER_ALICE,
		})
		.returning();

	console.log("[schedule:seed] inserting kanban columns");
	const columnRows = await db
		.insert(boardColumns)
		.values([
			{ boardId: prepBoard.id, label: "To Do", color: "#4f7bff", position: 0 },
			{
				boardId: prepBoard.id,
				label: "In Progress",
				color: "#f59e0b",
				position: 1,
			},
			{ boardId: prepBoard.id, label: "Review", color: "#8b5cf6", position: 2 },
			{ boardId: prepBoard.id, label: "Done", color: "#10b981", position: 3 },
		])
		.returning();

	const [colTodo, colInProgress, colReview, colDone] = columnRows;

	console.log("[schedule:seed] inserting kanban cards");
	await db.insert(boardCards).values([
		{
			boardId: prepBoard.id,
			columnId: colTodo.id,
			title: "Book venue A/V equipment",
			description:
				"Confirm projector, microphones, and streaming hardware with the venue.",
			position: 0,
			priority: "high",
			departmentId: DEPT_IT,
			labels: JSON.stringify([{ text: "Equipment", color: "#4f7bff" }]),
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colTodo.id,
			title: "Print badge stock",
			description: "Order lanyards and badge sheets — minimum 1200 units.",
			position: 1,
			priority: "medium",
			departmentId: DEPT_REGISTRATION,
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colTodo.id,
			title: "Draft volunteer orientation packet",
			position: 2,
			priority: "low",
			createdBy: USER_BOB,
		},
		{
			boardId: prepBoard.id,
			columnId: colInProgress.id,
			title: "Set up registration kiosks",
			description:
				"Deploy 4 self-service kiosks at the main entrance and test the badge-print flow.",
			position: 0,
			priority: "urgent",
			departmentId: DEPT_REGISTRATION,
			assigneeUserId: USER_CARLA,
			progress: 40,
			labels: JSON.stringify([
				{ text: "Setup", color: "#f59e0b" },
				{ text: "Hardware", color: "#4f7bff" },
			]),
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colInProgress.id,
			title: "Configure network switches",
			description: "Rack and configure the two managed switches in room 204.",
			position: 1,
			priority: "high",
			departmentId: DEPT_IT,
			assigneeUserId: USER_BOB,
			collaboratorUserIds: [USER_DAN],
			progress: 65,
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colReview.id,
			title: "Volunteer schedule v2",
			description:
				"Second draft of the full con schedule — needs coordinator sign-off.",
			position: 0,
			priority: "high",
			assigneeUserId: USER_ALICE,
			progress: 90,
			labels: JSON.stringify([{ text: "Schedule", color: "#8b5cf6" }]),
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colDone.id,
			title: "Reserve hotel room block",
			position: 0,
			priority: "medium",
			progress: 100,
			createdBy: USER_ALICE,
		},
		{
			boardId: prepBoard.id,
			columnId: colDone.id,
			title: "Secure venue contract",
			position: 1,
			priority: "urgent",
			progress: 100,
			createdBy: USER_ALICE,
		},
	]);

	console.log("[schedule:seed] done");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
