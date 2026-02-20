import { RuleTester } from "@typescript-eslint/rule-tester";
import { noExplicitReturnTypes } from "../src/rules/no-explicit-return-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("no-explicit-return-types", noExplicitReturnTypes, {
	invalid: [
		{
			code: `function foo(): number { return 1; }`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "function with explicit return type (not object/predicate)"
		},
		{
			code: `const fn = (): string => "hello";`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "arrow function with explicit return type"
		}
	],
	valid: [
		{
			code: `function foo() { return 1; }`,
			name: "function without return type"
		},
		{
			code: `function isString(x: unknown): x is string { return typeof x === "string"; }`,
			name: "type predicate return type (type guard)"
		},
		{
			code: `const fn = (): { a: number } => ({ a: 1 });`,
			name: "arrow function returning object literal directly"
		},
		{
			code: `function getStyle(): { color: string } { return { color: "red" }; }`,
			name: "function with single return of object literal"
		}
	]
});

console.log("no-explicit-return-types: All tests passed!");
