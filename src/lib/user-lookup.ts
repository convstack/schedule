const MAX_ENTRIES = 500;
const TTL_MS = 60_000;
const CACHE = new Map<string, { name: string; expiresAt: number }>();

/** Evict expired entries + oldest if over capacity. */
function prune() {
	if (CACHE.size <= MAX_ENTRIES) return;
	const now = Date.now();
	// First pass: remove expired
	for (const [key, val] of CACHE) {
		if (val.expiresAt < now) CACHE.delete(key);
	}
	// Second pass: if still over, delete oldest (Map iterates in insertion order)
	if (CACHE.size > MAX_ENTRIES) {
		const excess = CACHE.size - MAX_ENTRIES;
		let i = 0;
		for (const key of CACHE.keys()) {
			if (i++ >= excess) break;
			CACHE.delete(key);
		}
	}
}

export async function lookupUserName(userId: string): Promise<string> {
	const cached = CACHE.get(userId);
	if (cached && cached.expiresAt > Date.now()) return cached.name;

	const LANYARD_URL = process.env.LANYARD_URL || "http://localhost:3000";
	const SERVICE_KEY = process.env.LANYARD_SERVICE_KEY;
	if (!SERVICE_KEY) return "Unknown";

	try {
		const res = await fetch(`${LANYARD_URL}/api/users/${userId}`, {
			headers: { Authorization: `ServiceKey ${SERVICE_KEY}` },
		});
		if (!res.ok) return "Unknown";
		const user = (await res.json()) as { name?: string };
		const name = user.name ?? "Unknown";
		CACHE.set(userId, { name, expiresAt: Date.now() + TTL_MS });
		prune();
		return name;
	} catch {
		return "Unknown";
	}
}

export async function lookupManyUserNames(
	userIds: string[],
): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	await Promise.all(
		userIds.map(async (id) => {
			out.set(id, await lookupUserName(id));
		}),
	);
	return out;
}
