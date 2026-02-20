import { RuleTester } from "@typescript-eslint/rule-tester";
import { sortExports } from "../src/rules/sort-exports";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("sort-exports", sortExports, {
	invalid: [
		{
			code: `export const b = 2;\nexport const a = 1;`,
			errors: [{ messageId: "alphabetical" }],
			name: "unsorted exports (ascending)",
			output: `export const a = 1;\nexport const b = 2;`
		},
		{
			code: `export const a = 1;\nexport const b = 2;`,
			errors: [{ messageId: "alphabetical" }],
			name: "unsorted exports (descending)",
			options: [{ order: "desc" }],
			output: `export const b = 2;\nexport const a = 1;`
		}
	],
	valid: [
		{
			code: `export const a = 1;\nexport const b = 2;\nexport const c = 3;`,
			name: "already sorted exports"
		},
		{
			code: `export const z = 1;`,
			name: "single export (below minKeys)"
		},
		{
			code: `export const c = 3;\nexport const b = 2;\nexport const a = 1;`,
			name: "sorted descending",
			options: [{ order: "desc" }]
		}
	]
});

console.log("sort-exports: All tests passed!");
