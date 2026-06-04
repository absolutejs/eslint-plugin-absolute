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
		},
		{
			code: `const fn = function(): number { return 1; }`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "function expression with explicit return type"
		},
		{
			code: `function foo(): void { return; }`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "return with no argument and explicit void return type"
		},
		{
			code: `const identity = <T>(value: T): T => value;`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "type param used in params and return is inferable (still flagged)"
		},
		{
			code: `const first = <T>(values: T[]): T => values[0];`,
			errors: [{ messageId: "noExplicitReturnType" }],
			name: "type param used in a parameter type is inferable (still flagged)"
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
		},
		{
			code: `const fn = (): Obj => { return { a: 1 }; }`,
			name: "arrow with block body returning single object literal"
		},
		{
			code: `function foo(): Obj { if (x) return { a: 1 }; return { b: 2 }; }`,
			name: "multiple returns but only one direct return in block body (allowed)"
		},
		{
			code: `const serializeValue = (value: unknown): string => { if (Array.isArray(value)) return value.map(serializeValue).join(","); return String(value); };`,
			name: "recursive arrow assigned to const (self-reference requires annotation)"
		},
		{
			code: `function walk(node: Node): number { return node.children.reduce((sum, child) => sum + walk(child), 0); }`,
			name: "recursive function declaration (self-reference requires annotation)"
		},
		{
			code: `const fact = function go(n: number): number { return n <= 1 ? 1 : n * go(n - 1); };`,
			name: "recursive named function expression (self-reference requires annotation)"
		},
		{
			code: `const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);`,
			name: "type param only in return type cannot be inferred (annotation required)"
		},
		{
			code: `function asSet<T>(value: unknown): Set<T> { return new Set(); }`,
			name: "function declaration with return-only type param (annotation required)"
		},
		{
			code: `const toRecord = <T>(value: unknown): Record<string, T> => JSON.parse(String(value));`,
			name: "return-only type param nested in a generic (annotation required)"
		}
	]
});

console.log("no-explicit-return-types: All tests passed!");
