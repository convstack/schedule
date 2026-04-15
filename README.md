<img width="1400" height="400" alt="1400x400" src="https://github.com/user-attachments/assets/463a26bb-0425-4075-943f-a99f8a169382" />

> **Warning**
> This project is under active development and not yet ready for production use.

# Schedule

Schedule is the convention scheduling service for the Convention platform. It manages public events (panels, concerts, ceremonies), staff shifts, critter (volunteer) assignments, and the coordinator approval workflow.

## What it does

- **Public events** — Concerts, panels, ceremonies visible to all attendees
- **Staff shifts** — Staffable time slots tied to departments (Registration, Security, IT, etc.)
- **Critter assignments** — Volunteers request shifts, coordinators approve or decline
- **Approval queue** — Department coordinators review pending requests with conflict detection
- **"My shifts" view** — Critters see their pending/confirmed assignments at a glance
- **Convention settings** — Name, timezone, start/end dates, editable by admins with the `schedule:admin` permission
- **Critter profiles** — Optional volunteer metadata (t-shirt size, dietary needs, skills, availability)

## Architecture

Schedule is a backend REST API — it has no UI of its own. The Dashboard renders all Schedule UI dynamically from its JSON manifest using the calendar section types from Spec 3 (calendar-grid, calendar-day, calendar-month, agenda, upcoming-strip) plus a custom approval-queue section type.

Internally, handlers are defined as oRPC procedures (typed end-to-end within the service) and served via an OpenAPI HTTP adapter that emits standard REST. The Dashboard sees plain REST endpoints and never knows oRPC exists.

```
Browser → Dashboard (UI) → API Proxy → Schedule (oRPC → REST API + PostgreSQL)
                                     → Lanyard (Auth + Service Catalog + Departments)
```

### Key concepts

- **Events** — public schedule items (panels, concerts). Any coordinator can create them.
- **Shifts** — staffable slots tied to a department. Only coordinators of that department can manage them.
- **Assignments** — a critter's relationship to a shift. Status: `requested` → `approved` / `declined` / `withdrawn`.
- **Coordinators** — lanyard department members with `admin` or `owner` role. They manage shifts and approve requests for their department.
- **Critters** — any logged-in user who is NOT a department member. They volunteer for shifts during con time.
- **Visibility tiers** — public (counts only), staffer (roster with names), coordinator (full write access).

## Tech Stack

- **Runtime:** Bun
- **Framework:** TanStack React Start (for route handling)
- **API layer:** oRPC with OpenAPIHandler (typed procedures, REST output)
- **Database:** PostgreSQL via Drizzle ORM
- **Linting:** Biome

## Getting Started

### Prerequisites

- Bun installed
- PostgreSQL database
- Lanyard running (for authentication, departments, and service registration)
- Dashboard running (for the UI)

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://schedule:schedule@localhost:5432/schedule_dev
LANYARD_URL=http://localhost:3000
LANYARD_SERVICE_KEY=sk_svc_your_key_here
PORT=5050
```

### 3. Create the database and run migrations

```bash
# Create the database (if it doesn't exist) + run migrations:
createdb schedule_dev  # or via your preferred method
bun run db:migrate
```

### 4. (Optional) Seed fixture data

```bash
bun run db:seed
```

Populates ~10 events, ~30 shifts, ~50 assignments across multiple departments for development testing.

### 5. Register with Lanyard

Before the Schedule service can appear in the Dashboard, it needs to be registered as a service in Lanyard:

1. Sign in to Dashboard as an admin
2. Go to **Lanyard Admin → Services → Register Service**
3. Fill in:
   - **Name:** Schedule
   - **Slug:** `schedule`
   - **Type:** Service
   - **Base URL:** `http://localhost:5050`
   - **Health Check Path:** `/api/health`
4. Click **Register Service**
5. **Copy the API key** and set it in your `.env`:

```env
LANYARD_SERVICE_KEY=sk_svc_your_copied_key_here
```

### 6. Map the schedule:admin permission

To allow specific department roles to edit convention settings:

1. Go to **Lanyard Admin → Services → Schedule → Manage Permissions**
2. Click **Add Mapping**
3. Select a department, a role (e.g. Admin), and check `schedule:admin`
4. Save

### 7. Start the dev server

```bash
bun run dev
```

Schedule will:

- Start on port 5050
- Send a heartbeat to Lanyard with its UI manifest
- Appear in the Dashboard sidebar as "Schedule"

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start dev server (port 5050) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migrations |
| `bun run db:seed` | Seed fixture data |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Biome linting |

## API Endpoints

### Events (public schedule)

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/api/events` | GET | Public | List events (ScheduleData) |
| `/api/events/:id` | GET | Public | Single event |
| `/api/events` | POST | Any coordinator | Create event |
| `/api/events/:id` | PATCH | Any coordinator | Update event |
| `/api/events/:id` | DELETE | Any coordinator | Delete event |
| `/api/events/:id/publish` | POST | Any coordinator | Draft → published |
| `/api/events/:id/archive` | POST | Any coordinator | Published → archived |

### Shifts (staffable slots)

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/api/shifts` | GET | Public | List shifts (ScheduleData) |
| `/api/shifts/:id` | GET | Public | Single shift |
| `/api/shifts/mine` | GET | Authenticated | My assignments |
| `/api/shifts` | POST | Dept coordinator | Create shift |
| `/api/shifts/:id` | PATCH | Dept coordinator | Update shift |
| `/api/shifts/:id` | DELETE | Dept coordinator | Delete shift |
| `/api/shifts/:id/publish` | POST | Dept coordinator | Draft → published |
| `/api/shifts/:id/request` | POST | Authenticated | Request a shift |

### Assignments (approval workflow)

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/api/assignments/queue` | GET | Coordinator | Pending requests |
| `/api/assignments/:id/approve` | POST | Dept coordinator | Approve request |
| `/api/assignments/:id/decline` | POST | Dept coordinator | Decline request |
| `/api/assignments/:id/withdraw` | POST | Own assignment | Withdraw |

### Other

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/api/critter/profile` | GET | Authenticated | Get own profile |
| `/api/critter/profile` | PUT | Authenticated | Upsert own profile |
| `/api/settings` | GET | Authenticated | Convention settings |
| `/api/settings` | PUT | `schedule:admin` | Update settings |
| `/api/health` | GET | Public | Health check |

## Database Tables

| Table | Purpose |
|---|---|
| `events` | Public schedule items (panels, concerts, etc.) |
| `shifts` | Staffable time slots tied to departments |
| `assignments` | Critter ↔ shift relationship with status enum |
| `assignment_history` | Audit log of every state transition |
| `critter_profiles` | Optional volunteer metadata |
| `settings` | Convention-wide config (name, timezone, dates) |

---

Made and maintained with 🧡 by [Headpat](https://headpat.space)
