import { RuleTester } from "@typescript-eslint/rule-tester";
import { preferInlineExports } from "../src/rules/prefer-inline-exports";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("prefer-inline-exports", preferInlineExports, {
	invalid: [
		{
			code: `const foo = 1;\nexport { foo };`,
			errors: [{ messageId: "preferInline" }],
			name: "trailing export of local const",
			output: `export const foo = 1;\n`
		},
		{
			code: `function foo() { return 1; }\nexport { foo };`,
			errors: [{ messageId: "preferInline" }],
			name: "trailing export of local function",
			output: `export function foo() { return 1; }\n`
		},
		{
			code: `class Foo {}\nexport { Foo };`,
			errors: [{ messageId: "preferInline" }],
			name: "trailing export of local class",
			output: `export class Foo {}\n`
		},
		{
			code: `type Foo = number;\nexport { Foo };`,
			errors: [{ messageId: "preferInline" }],
			name: "trailing export of local type alias",
			output: `export type Foo = number;\n`
		},
		{
			code: `const foo = 1;\nconst bar = 2;\nexport { foo, bar };`,
			errors: [{ messageId: "preferInline" }],
			name: "multiple specifiers, both inlined",
			output: `export const foo = 1;\nexport const bar = 2;\n`
		},
		{
			code: `const foo = 1;\nimport { Sentry } from "x";\nexport { foo, Sentry };`,
			errors: [{ messageId: "preferInline" }],
			name: "mixes local and imported binding — only local fixed",
			output: `export const foo = 1;\nimport { Sentry } from "x";\nexport { Sentry };`
		}
	],
	valid: [
		{
			code: `export const foo = 1;`,
			name: "inline export already"
		},
		{
			code: `const foo = 1;\nexport { foo as bar };`,
			name: "renamed specifier — alias is the public name"
		},
		{
			code: `import * as Sentry from "x";\nSentry.init();\nexport { Sentry };`,
			name: "re-export of imported namespace — cannot be inlined"
		},
		{
			code: `import { Foo } from "x";\nexport { Foo };`,
			name: "re-export of imported binding"
		},
		{
			code: `export { foo } from "./other";`,
			name: "re-export from another module"
		},
		{
			code: `class Foo {}\nexport { type Foo };`,
			name: "type-only specifier on a value declaration"
		},
		{
			code: `class Foo {}\nexport type { Foo };`,
			name: "type-only export statement"
		},
		{
			code: `const a = 1, b = 2;\nexport { a };`,
			name: "shared declaration with multiple declarators — cannot prepend export to one"
		},
		{
			code: `export const foo = 1;\nexport { foo };`,
			name: "already exported inline elsewhere — duplicate spec is a different problem"
		}
	]
});

console.log("prefer-inline-exports: All tests passed!");
