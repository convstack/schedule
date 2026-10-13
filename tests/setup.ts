import { vi } from "vitest";

vi.mock("@convstack/service-sdk/handlers", async (importOriginal) => {
	const { withStubbedProof } = await import("./support/caller");
	return withStubbedProof(
		await importOriginal<typeof import("@convstack/service-sdk/handlers")>(),
	);
});
vi.mock("~/db", async () => {
	const { db } = await import("./support/fake-db");
	return { db };
});
vi.mock("drizzle-orm", async () => {
	const { drizzleModule } = await import("./support/fake-db");
	return drizzleModule;
});
vi.mock("~/db/schema/boards", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/boards"];
});
vi.mock("~/db/schema/board-columns", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/board-columns"];
});
vi.mock("~/db/schema/board-cards", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/board-cards"];
});
vi.mock("~/db/schema/board-card-comments", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/board-card-comments"];
});
vi.mock("~/db/schema/events", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/events"];
});
vi.mock("~/db/schema/shifts", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/shifts"];
});
vi.mock("~/db/schema/assignments", async () => {
	const { schemaModules } = await import("./support/fake-db");
	return schemaModules["~/db/schema/assignments"];
});
vi.mock("~/lib/dept-lookup", () => ({
	lookupDepartmentName: async () => null,
}));
vi.mock("~/lib/user-lookup", () => ({
	lookupManyUserNames: async () => new Map(),
}));
