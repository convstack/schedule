import { describe, expect, it } from "vitest";
import { schemaModules } from "../support/fake-db";

describe("the fake schema", () => {
	it("refuses a column it doesn't know instead of matching nothing", () => {
		const table = schemaModules["~/db/schema/boards"].boards as Record<
			string,
			unknown
		>;
		expect(() => table.noSuchColumn).toThrow(/no column/);
	});
});
