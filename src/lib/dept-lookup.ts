interface Department {
	id: string;
	name: string;
}

const MAX_ENTRIES = 200;
const TTL_MS = 60_000;
const CACHE = new Map<string, { dept: Department; expiresAt: number }>();

function prune() {
	if (CACHE.size <= MAX_ENTRIES) return;
	const now = Date.now();
	for (const [key, val] of CACHE) {
		if (val.expiresAt < now) CACHE.delete(key);
	}
	if (CACHE.size > MAX_ENTRIES) {
		const excess = CACHE.size - MAX_ENTRIES;
		let i = 0;
		for (const key of CACHE.keys()) {
			if (i++ >= excess) break;
			CACHE.delete(key);
		}
	}
}

/**
 * Look up a department name from lanyard. Returns `null` on any failure.
 * Callers decide their own fallback — usually `r.slug` from orgRoles.
 */
export async function lookupDepartmentName(
	deptId: string,
): Promise<string | null> {
	const cached = CACHE.get(deptId);
	if (cached && cached.expiresAt > Date.now()) return cached.dept.name;

	const LANYARD_URL = process.env.LANYARD_URL || "http://localhost:3000";
	const SERVICE_KEY = process.env.LANYARD_SERVICE_KEY;
	if (!SERVICE_KEY) return null;

	try {
		const res = await fetch(`${LANYARD_URL}/api/admin/departments/${deptId}`, {
			headers: { Authorization: `ServiceKey ${SERVICE_KEY}` },
		});
		if (!res.ok) return null;
		const dept = (await res.json()) as Partial<Department>;
		if (!dept.name) return null;
		CACHE.set(deptId, {
			dept: { id: deptId, name: dept.name },
			expiresAt: Date.now() + TTL_MS,
		});
		prune();
		return dept.name;
	} catch {
		return null;
	}
}
