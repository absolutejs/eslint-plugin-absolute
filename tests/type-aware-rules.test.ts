import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import plugin from "../src/index";

/* A rule that reads the type checker must say so (meta.docs
 * requiresTypeChecking), or a project that lints without type information
 * has no way to know it is getting fewer findings from it. Three rules used
 * types without declaring it, and onSpark's lint cost analysis missed them. */

const rulesDirectory = join(import.meta.dir, "..", "src", "rules");
const TYPE_CHECKER_USE =
	/getTypeChecker|parserServices\.program|esTreeNodeToTSNodeMap/;

describe("rules that use type information declare it", () => {
	const ruleFiles = readdirSync(rulesDirectory).filter((file) =>
		file.endsWith(".ts")
	);
	const typeAware = ruleFiles
		.filter((file) =>
			TYPE_CHECKER_USE.test(
				readFileSync(join(rulesDirectory, file), "utf-8")
			)
		)
		.map((file) => file.replace(/\.ts$/, ""));

	test("the known type-aware rules are found", () => {
		expect(typeAware).toEqual(
			expect.arrayContaining([
				"no-redundant-type-annotation",
				"prefer-drizzle-query-builders",
				"sort-keys-fixable"
			])
		);
	});

	for (const name of typeAware)
		test(`${name} declares requiresTypeChecking`, () => {
			const rule = Object.entries(plugin.rules).find(
				([ruleName]) => ruleName === name
			)?.[1];
			expect(rule?.meta.docs).toMatchObject({
				requiresTypeChecking: true
			});
		});
});
