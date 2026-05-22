import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { noTrivialAlias } from "../src/rules/no-trivial-alias";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const ruleTester = new RuleTester({
	languageOptions: {
		parser: parser.parser,
		parserOptions: {
			project: "./tsconfig.json",
			tsconfigRootDir: path.join(dirname, "fixtures")
		}
	}
});

const filename = "file.ts";

ruleTester.run("no-trivial-alias", noTrivialAlias, {
	invalid: [
		{
			code: `type TagWithCount = { id: string };\ntype Tag = TagWithCount;`,
			errors: [{ data: { name: "Tag" }, messageId: "trivialTypeAlias" }],
			filename,
			name: "type pure rename of another type"
		},
		{
			code: `type AccountId = string;`,
			errors: [
				{ data: { name: "AccountId" }, messageId: "trivialTypeAlias" }
			],
			filename,
			name: "branded-primitive alias (no semantic distinction at runtime)"
		},
		{
			code: `type Foo = number;`,
			errors: [{ data: { name: "Foo" }, messageId: "trivialTypeAlias" }],
			filename,
			name: "primitive alias number"
		},
		{
			code: `declare const original: number;\nconst alias = original;`,
			errors: [
				{ data: { name: "alias" }, messageId: "trivialConstAlias" }
			],
			filename,
			name: "const pure rename of another const"
		},
		{
			code: `const x = 1;\nconst y = x;`,
			errors: [{ data: { name: "y" }, messageId: "trivialConstAlias" }],
			filename,
			name: "const rename of a literal-initialized const"
		}
	],
	valid: [
		// Transformations: generic application, unions, type operators — not bare renames.
		{
			code: `type Foo = Array<string>;`,
			filename,
			name: "type with generic application"
		},
		{
			code: `type Foo = string | number;`,
			filename,
			name: "type union"
		},
		{
			code: `type Foo = { a: number } & { b: string };`,
			filename,
			name: "type intersection"
		},
		{
			code: `interface Bar { a: number }\ntype Foo = Pick<Bar, "a">;`,
			filename,
			name: "Pick transformation"
		},
		{
			code: `declare function f(): number;\ntype Foo = ReturnType<typeof f>;`,
			filename,
			name: "ReturnType derivation"
		},
		{
			code: `type Schema = { a: number };\ntype Foo = Schema["a"];`,
			filename,
			name: "indexed access"
		},
		{
			code: `type Foo = \`hello-\${string}\`;`,
			filename,
			name: "template literal type"
		},
		{
			code: `type Foo = { a: number };`,
			filename,
			name: "object type literal (not a rename)"
		},
		{
			code: `type Foo = readonly string[];`,
			filename,
			name: "readonly array (operator)"
		},
		// Const values where the initializer carries meaning.
		{
			code: `const x = 1;`,
			filename,
			name: "const with literal initializer"
		},
		{
			code: `declare function f(): number;\nconst x = f();`,
			filename,
			name: "const with call initializer"
		},
		{
			code: `declare const obj: { foo: number };\nconst x = obj.foo;`,
			filename,
			name: "const with member access initializer (can carry meaning)"
		},
		{
			code: `declare const x: unknown;\nconst y = x as number;`,
			filename,
			name: "const with as-cast (transformation)"
		},
		{
			code: `declare const arr: number[];\nconst [first] = arr;`,
			filename,
			name: "destructuring (out of scope)"
		},
		{
			code: `type Narrow = string & { __brand: "narrow" };\ndeclare const wide: string;\nconst narrow: Narrow = wide as Narrow;`,
			filename,
			name: "narrowing annotation with as-cast initializer (annotation does work)"
		},
		{
			code: `declare const y: unknown;\nconst x: number = y as number;`,
			filename,
			name: "narrowing annotation (defer to no-redundant-type-annotation)"
		},
		// Save-before-mutation: source is `let`, capture has meaning.
		{
			code: `let waiter: (() => void) | null = () => {};\nif (waiter) {\n  const resolve = waiter;\n  waiter = null;\n  resolve();\n}`,
			filename,
			name: "save-before-null capture from let source"
		},
		{
			code: `let counter = 0;\nconst snapshot = counter;\ncounter += 1;`,
			filename,
			name: "capture from let before mutation"
		},
		{
			code: `var legacy = "foo";\nconst alias = legacy;`,
			filename,
			name: "var source — reassignable, skip"
		},
		{
			code: `function f(body: unknown) {\n  const renamed = body;\n  return renamed;\n}`,
			filename,
			name: "parameter source — reassignable in TS, skip"
		}
	]
});

console.log("no-trivial-alias: All tests passed!");
