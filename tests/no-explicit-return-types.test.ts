import { RuleTester } from "@typescript-eslint/rule-tester";
import { noExplicitReturnTypes } from "../src/rules/no-explicit-return-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parser: parser.parser
	}
});

ruleTester.run("no-explicit-return-types", noExplicitReturnTypes, {
	valid: [
		{
			name: "function without return type",
			code: `function foo() { return 1; }`
		},
		{
			name: "type predicate return type (type guard)",
			code: `function isString(x: unknown): x is string { return typeof x === "string"; }`
		},
		{
			name: "arrow function returning object literal directly",
			code: `const fn = (): { a: number } => ({ a: 1 });`
		},
		{
			name: "function with single return of object literal",
			code: `function getStyle(): { color: string } { return { color: "red" }; }`
		}
	],
	invalid: [
		{
			name: "function with explicit return type (not object/predicate)",
			code: `function foo(): number { return 1; }`,
			errors: [{ messageId: "noExplicitReturnType" }]
		},
		{
			name: "arrow function with explicit return type",
			code: `const fn = (): string => "hello";`,
			errors: [{ messageId: "noExplicitReturnType" }]
		}
	]
});

console.log("no-explicit-return-types: All tests passed!");
