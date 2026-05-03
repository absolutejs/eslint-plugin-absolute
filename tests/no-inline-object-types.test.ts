import { RuleTester } from "@typescript-eslint/rule-tester";
import { noInlineObjectTypes } from "../src/rules/no-inline-object-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("no-inline-object-types", noInlineObjectTypes, {
	invalid: [
		// --- Variable annotations ---
		{
			code: `const example: { item: string; test: number } = { item: "a", test: 1 };`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "const with multi-property inline object type"
		},
		{
			code: `let user: { name: string; age: number };`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "let with no initializer"
		},
		{
			code: `const handler: { onClick: () => void; onHover(): void } = {} as any;`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "method signatures count toward members"
		},
		{
			code: `const userName: { first: string; last: string } = { first: "a", last: "b" };`,
			errors: [
				{
					data: { suggestedName: "UserName" },
					messageId: "inlineObjectType"
				}
			],
			name: "suggests PascalCase name from camelCase variable"
		},
		{
			code: `const my_thing: { a: string; b: number } = { a: "x", b: 1 };`,
			errors: [
				{
					data: { suggestedName: "MyThing" },
					messageId: "inlineObjectType"
				}
			],
			name: "suggests PascalCase name from snake_case variable"
		},
		{
			code: `const opts: { minProperties?: number; max?: number } = {};`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "optional properties still count"
		},

		// --- Wrapped types still descend ---
		{
			code: `const items: { id: string; name: string }[] = [];`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "T[] array of inline object type"
		},
		{
			code: `const items: Array<{ id: string; name: string }> = [];`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "Array<T> generic of inline object type"
		},
		{
			code: `const result: Promise<{ ok: boolean; data: string }> = Promise.resolve({} as any);`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "Promise<T> wrapping inline object type"
		},
		{
			code: `const lookup: Record<string, { id: string; name: string }> = {};`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "Record<K, V> with inline object type as value"
		},
		{
			code: `const value: { a: string; b: number } | null = null;`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "union of inline object type with null"
		},
		{
			code: `const value: { a: string; b: number } | { c: string; d: number } = {} as any;`,
			errors: [
				{ messageId: "inlineObjectType" },
				{ messageId: "inlineObjectType" }
			],
			name: "union of two inline object types reports both"
		},
		{
			code: `const nested: Promise<Array<{ id: string; name: string }>> = Promise.resolve([]);`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "deeply nested generics descend correctly"
		},

		// --- Class field annotations ---
		{
			code: `class User { profile: { name: string; age: number } = { name: "a", age: 1 }; }`,
			errors: [
				{
					data: { suggestedName: "Profile" },
					messageId: "inlineObjectType"
				}
			],
			name: "class field with inline object type"
		},
		{
			code: `class Box { contents: { items: string[]; count: number } | null = null; }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "class field with wrapped inline object type"
		},
		{
			code: `class Bag { items: { id: string; name: string }[] = []; }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "class field with array of inline object type"
		},

		// --- Function parameters ---
		{
			code: `function foo(opts: { a: string; b: number }) { return opts; }`,
			errors: [
				{
					data: { suggestedName: "Opts" },
					messageId: "inlineObjectType"
				}
			],
			name: "function param with inline object type"
		},
		{
			code: `const fn = (opts: { a: string; b: number }) => opts;`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "arrow function param with inline object type"
		},
		{
			code: `function foo({ a, b }: { a: string; b: number }) { return a; }`,
			errors: [
				{
					data: { suggestedName: "Params" },
					messageId: "inlineObjectType"
				}
			],
			name: "destructured param falls back to 'Params' suggestion"
		},
		{
			code: `function foo(a: string, opts: { x: number; y: number }) { return opts; }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "second param with inline object type still flagged"
		},
		{
			code: `function foo(opts: { a: string; b: number } = { a: "", b: 0 }) { return opts; }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "param with default value still flagged"
		},
		{
			code: `function foo(...rest: { a: string; b: number }[]) { return rest; }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "rest param with array of inline object type"
		},
		{
			code: `class C { method(opts: { a: string; b: number }) { return opts; } }`,
			errors: [{ messageId: "inlineObjectType" }],
			name: "class method param with inline object type"
		},
		{
			code: `class C { constructor(public config: { host: string; port: number }) {} }`,
			errors: [
				{
					data: { suggestedName: "Config" },
					messageId: "inlineObjectType"
				}
			],
			name: "constructor parameter property with inline object type"
		},

		// --- Generic call/new arguments ---
		{
			code: `const state = useState<{ id: string; name: string }>(null as any);`,
			errors: [
				{
					data: { suggestedName: "State" },
					messageId: "inlineObjectType"
				}
			],
			name: "generic call argument with inline object type"
		},
		{
			code: `const cache = new Map<string, { id: string; name: string }>();`,
			errors: [
				{
					data: { suggestedName: "Cache" },
					messageId: "inlineObjectType"
				}
			],
			name: "generic new expression with inline object type as value"
		},
		{
			code: `useState<{ id: string; name: string }>(null as any);`,
			errors: [
				{ data: { suggestedName: "T" }, messageId: "inlineObjectType" }
			],
			name: "generic call without enclosing identifier falls back to 'T'"
		}
	],
	valid: [
		{
			code: `const x: { id: string } = { id: "a" };`,
			name: "single-property inline type below default threshold"
		},
		{
			code: `const items: { id: string }[] = [];`,
			name: "single-property inline type below threshold inside array"
		},
		{
			code: `type User = { name: string; age: number }; const u: User = { name: "a", age: 1 };`,
			name: "named type alias is fine"
		},
		{
			code: `const x = { a: 1, b: 2 };`,
			name: "no annotation at all"
		},
		{
			code: `const x: string = "a";`,
			name: "primitive annotation"
		},
		{
			code: `const users: User[] = [];`,
			name: "array of named type"
		},
		{
			code: `const x: string | null = null;`,
			name: "union of primitives"
		},
		{
			code: `const x = obj as { a: string; b: number };`,
			name: "as-cast is not a variable annotation"
		},
		{
			code: `const x: { [key: string]: number } = {};`,
			name: "index signature only — record-shaped type skipped"
		},
		{
			code: `const x: Array<{ [key: string]: number }> = [];`,
			name: "index-signature-only inside array also skipped"
		},
		{
			code: `const { a, b }: { a: string; b: number } = obj;`,
			name: "destructuring variable pattern not flagged (no good name)"
		},
		{
			code: `const x: { id: string; name: string } = { id: "a", name: "b" };`,
			name: "respects minProperties option set higher",
			options: [{ minProperties: 3 }]
		},

		// --- Class field valids ---
		{
			code: `type Profile = { name: string; age: number }; class User { profile: Profile = { name: "a", age: 1 }; }`,
			name: "class field with named type"
		},
		{
			code: `class User { id: string = ""; }`,
			name: "class field with primitive annotation"
		},
		{
			code: `class User { name = "x"; }`,
			name: "class field without type annotation"
		},

		// --- Function param valids ---
		{
			code: `type Opts = { a: string; b: number }; function foo(opts: Opts) { return opts; }`,
			name: "function param with named type"
		},
		{
			code: `function foo() { return null; }`,
			name: "function with no params"
		},
		{
			code: `function foo(callback: () => void) { callback(); }`,
			name: "function param with function type (not an object literal)"
		},
		{
			code: `function foo(opts: { id: string }) { return opts; }`,
			name: "single-property param below threshold"
		},

		// --- Generic call/new valids ---
		{
			code: `const state = useState<User>(null);`,
			name: "generic call with named type"
		},
		{
			code: `const x = fn(arg);`,
			name: "call expression without type arguments"
		},
		{
			code: `const cache = new Map<string, User>();`,
			name: "generic new with named type"
		},
		{
			code: `const cache = new Map<string, { id: string }>();`,
			name: "generic new with single-property inline type below threshold"
		}
	]
});

console.log("no-inline-object-types: All tests passed!");
