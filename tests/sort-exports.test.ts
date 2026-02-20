import { RuleTester } from "@typescript-eslint/rule-tester";
import { sortExports } from "../src/rules/sort-exports";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("sort-exports", sortExports, {
	valid: [
		{
			name: "already sorted exports",
			code: `export const a = 1;\nexport const b = 2;\nexport const c = 3;`
		},
		{
			name: "single export (below minKeys)",
			code: `export const z = 1;`
		},
		{
			name: "sorted descending",
			code: `export const c = 3;\nexport const b = 2;\nexport const a = 1;`,
			options: [{ order: "desc" }]
		}
	],
	invalid: [
		{
			name: "unsorted exports (ascending)",
			code: `export const b = 2;\nexport const a = 1;`,
			errors: [{ messageId: "alphabetical" }],
			output: `export const a = 1;\nexport const b = 2;`
		},
		{
			name: "unsorted exports (descending)",
			code: `export const a = 1;\nexport const b = 2;`,
			options: [{ order: "desc" }],
			errors: [{ messageId: "alphabetical" }],
			output: `export const b = 2;\nexport const a = 1;`
		}
	]
});

console.log("sort-exports: All tests passed!");
