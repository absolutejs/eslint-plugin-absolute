import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { sortExports } from "../src/rules/sort-exports";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

const tsRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
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
		},
		// caseSensitive option
		{
			code: `export const banana = 1;\nexport const Apple = 2;`,
			errors: [{ messageId: "alphabetical" }],
			name: "case-sensitive sorting treats uppercase before lowercase",
			options: [{ caseSensitive: true }],
			output: `export const Apple = 2;\nexport const banana = 1;`
		},
		{
			code: `export const b = 1;\nexport const A = 2;`,
			errors: [{ messageId: "alphabetical" }],
			name: "case-sensitive: 'A' before 'b'",
			options: [{ caseSensitive: true }],
			output: `export const A = 2;\nexport const b = 1;`
		},
		// natural option
		{
			code: `export const export10 = 10;\nexport const export2 = 2;`,
			errors: [{ messageId: "alphabetical" }],
			name: "natural sorting: export2 before export10",
			options: [{ natural: true }],
			output: `export const export2 = 2;\nexport const export10 = 10;`
		},
		{
			code: `export const item20 = 20;\nexport const item3 = 3;\nexport const item1 = 1;`,
			errors: [{ messageId: "alphabetical" }],
			name: "natural sorting: multiple numeric suffixes",
			options: [{ natural: true }],
			output: `export const item1 = 1;\nexport const item3 = 3;\nexport const item20 = 20;`
		},
		// variablesBeforeFunctions option
		{
			code: `export function alpha() {}\nexport const beta = 1;`,
			errors: [{ messageId: "variablesBeforeFunctions" }],
			name: "variablesBeforeFunctions: function before variable",
			options: [{ variablesBeforeFunctions: true }],
			output: `export const beta = 1;\nexport function alpha() {};`
		},
		{
			code: `export const greet = () => {};\nexport const count = 1;`,
			errors: [{ messageId: "variablesBeforeFunctions" }],
			name: "variablesBeforeFunctions: arrow function export before variable",
			options: [{ variablesBeforeFunctions: true }],
			output: `export const count = 1;\nexport const greet = () => {};`
		},
		{
			code: `export function zoo() {}\nexport const alpha = 1;\nexport function mid() {}`,
			errors: [{ messageId: "variablesBeforeFunctions" }],
			name: "variablesBeforeFunctions: mixed functions and variables unsorted",
			options: [{ variablesBeforeFunctions: true }],
			output: `export const alpha = 1;\nexport function mid() {};\nexport function zoo() {};`
		},
		// export function and export class
		{
			code: `export function beta() {}\nexport function alpha() {}`,
			errors: [{ messageId: "alphabetical" }],
			name: "unsorted export function declarations",
			output: `export function alpha() {};\nexport function beta() {};`
		},
		{
			code: `export class Zebra {}\nexport class Alpha {}`,
			errors: [{ messageId: "alphabetical" }],
			name: "unsorted export class declarations",
			output: `export class Alpha {};\nexport class Zebra {};`
		},
		{
			code: `export function foo() {}\nexport class Bar {}\nexport const alpha = 1;`,
			errors: [{ messageId: "alphabetical" }],
			name: "mixed function, class, and const exports unsorted",
			output: `export const alpha = 1;\nexport class Bar {};\nexport function foo() {};`
		},
		// export specifiers (no source — local re-exports)
		{
			code: `const foo = 1;\nconst bar = 2;\nexport { foo };\nexport { bar };`,
			errors: [{ messageId: "alphabetical" }],
			name: "unsorted export specifiers",
			output: `const foo = 1;\nconst bar = 2;\nexport { bar };\nexport { foo };`
		},
		// non-contiguous export blocks: second block is unsorted
		{
			code: `export const alpha = 1;\nexport const beta = 2;\nconst x = 0;\nexport const zulu = 4;\nexport const mike = 3;`,
			errors: [{ messageId: "alphabetical" }],
			name: "non-contiguous blocks: second block unsorted",
			output: `export const alpha = 1;\nexport const beta = 2;\nconst x = 0;\nexport const mike = 3;\nexport const zulu = 4;`
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
		},
		// caseSensitive option
		{
			code: `export const Apple = 1;\nexport const banana = 2;`,
			name: "case-sensitive sorted: uppercase before lowercase",
			options: [{ caseSensitive: true }]
		},
		{
			code: `export const apple = 1;\nexport const Banana = 2;`,
			name: "case-insensitive (default): case-mixed but alphabetical ignoring case"
		},
		// natural option
		{
			code: `export const export2 = 2;\nexport const export10 = 10;`,
			name: "natural sorting: export2 before export10",
			options: [{ natural: true }]
		},
		{
			code: `export const item1 = 1;\nexport const item3 = 3;\nexport const item20 = 20;`,
			name: "natural sorting: multiple numeric suffixes in order",
			options: [{ natural: true }]
		},
		// minKeys option
		{
			code: `export const c = 3;\nexport const b = 2;\nexport const a = 1;`,
			name: "minKeys: 4 — block of 3 is below threshold, not reported",
			options: [{ minKeys: 4 }]
		},
		{
			code: `export const z = 1;\nexport const a = 2;`,
			name: "minKeys: 3 — block of 2 is below threshold, not reported",
			options: [{ minKeys: 3 }]
		},
		// variablesBeforeFunctions option
		{
			code: `export const alpha = 1;\nexport const beta = 2;\nexport function gamma() {}`,
			name: "variablesBeforeFunctions: variables before function already sorted",
			options: [{ variablesBeforeFunctions: true }]
		},
		{
			code: `export const x = 1;\nexport const greet = () => {};\nexport function zoo() {}`,
			name: "variablesBeforeFunctions: plain variable before arrow fn (arrow is function)",
			options: [{ variablesBeforeFunctions: true }]
		},
		// export function and export class
		{
			code: `export function alpha() {}\nexport function beta() {}`,
			name: "sorted export function declarations"
		},
		{
			code: `export class Alpha {}\nexport class Zebra {}`,
			name: "sorted export class declarations"
		},
		{
			code: `export const a = 1;\nexport class Beta {}\nexport function charlie() {}`,
			name: "sorted mixed const, class, and function exports"
		},
		// export specifiers (no source — local re-exports)
		{
			code: `const bar = 1;\nconst foo = 2;\nexport { bar };\nexport { foo };`,
			name: "sorted export specifiers"
		},
		// re-exports with source are ignored by the rule
		{
			code: `export { zoo } from './zoo';\nexport { alpha } from './alpha';`,
			name: "re-exports with source are ignored (not checked)"
		},
		// non-contiguous export blocks: both blocks independently sorted
		{
			code: `export const alpha = 1;\nexport const beta = 2;\nconst x = 0;\nexport const mike = 3;\nexport const zulu = 4;`,
			name: "non-contiguous blocks: both blocks sorted independently"
		},
		// forward dependency detection: exports referencing later exports skip sorting
		{
			code: `export const b = a + 1;\nexport const a = 1;`,
			name: "forward dependency: b references a (defined later), skips sorting"
		},
		{
			code: `export const second = first;\nexport const first = 42;`,
			name: "forward dependency: second references first, skip sorting"
		}
	]
});

// Separate run for TypeScript-specific syntax (needs TS parser)
tsRuleTester.run("sort-exports (type exports)", sortExports, {
	invalid: [],
	valid: [
		// export type — TSTypeAliasDeclaration is not handled by getDeclarationName,
		// so these exports are ignored (name is null) and do not affect sorting.
		{
			code: `export type Zebra = string;\nexport type Alpha = number;`,
			name: "type alias exports are ignored (unsorted but no error)"
		},
		{
			code: `export const a = 1;\nexport type Zebra = string;\nexport const b = 2;`,
			name: "type alias export between value exports breaks contiguous block"
		}
	]
});

console.log("sort-exports: All tests passed!");
