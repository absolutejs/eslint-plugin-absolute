import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { noRedundantTypeAnnotation } from "../src/rules/no-redundant-type-annotation";

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

ruleTester.run("no-redundant-type-annotation", noRedundantTypeAnnotation, {
	invalid: [
		{
			code: `function bar(): number { return 1; }\nconst foo: number = bar();`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "call expression with matching return type",
			output: `function bar(): number { return 1; }\nconst foo = bar();`
		},
		{
			code: `const xs: string[] = ["a", "b"].filter((s): s is string => s.length > 0);`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "generic whose type param is inferred from an argument is still flagged",
			output: `const xs = ["a", "b"].filter((s): s is string => s.length > 0);`
		},
		{
			code: `class Foo {}\nconst foo: Foo = new Foo();`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "new expression with matching class type",
			output: `class Foo {}\nconst foo = new Foo();`
		},
		{
			code: `declare const x: number;\nconst foo: number = x;`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "identifier with matching type",
			output: `declare const x: number;\nconst foo = x;`
		},
		{
			code: `declare const obj: { a: number };\nconst foo: number = obj.a;`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "member access with matching type",
			output: `declare const obj: { a: number };\nconst foo = obj.a;`
		},
		{
			code: `declare const x: unknown;\nconst foo: number = x as number;`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "as cast already gives the annotation type",
			output: `declare const x: unknown;\nconst foo = x as number;`
		},
		{
			code: `interface User { name: string }\ndeclare function getUser(): User;\nconst u: User = getUser();`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "interface annotation matching call return",
			output: `interface User { name: string }\ndeclare function getUser(): User;\nconst u = getUser();`
		},
		{
			code: `declare function load(): Promise<number>;\nconst p: Promise<number> = load();`,
			errors: [{ messageId: "redundantTypeAnnotation" }],
			filename,
			name: "generic type matches",
			output: `declare function load(): Promise<number>;\nconst p = load();`
		}
	],
	valid: [
		// A generic call whose return-position type param is inferred from the
		// annotation: the types match only *because* of the annotation, so it's
		// not redundant (removing it would change the inferred type).
		{
			code: `declare function pick<E = string>(s: string): E | null;\nconst v: number | null = pick("x");`,
			filename,
			name: "generic call inferring its type param from the annotation"
		},
		{
			// A complex selector (not a literal tag) resolves to querySelector's
			// generic `(s: string): E | null` overload, where `E` is fixed by the
			// annotation — removing it would widen to `Element`.
			code: `const el: HTMLInputElement | null = document.querySelector("input[name='x']");`,
			filename,
			name: "querySelector generic inferred from the annotation"
		},
		// Literal-widening case — the annotation does work, don't flag.
		{
			code: `const foo: string = "hello";`,
			filename,
			name: "string annotation on string literal (widening)"
		},
		{
			code: `const foo: number = 42;`,
			filename,
			name: "number annotation on number literal (widening)"
		},
		// Initializers excluded from the allowlist.
		{
			code: `const foo: string[] = [];`,
			filename,
			name: "array literal initializer (contextual type matters)"
		},
		{
			code: `const foo: { a: number } = { a: 1 };`,
			filename,
			name: "object literal initializer (contextual type)"
		},
		{
			code: `const foo: () => number = () => 1;`,
			filename,
			name: "function expression initializer"
		},
		// Annotations that genuinely differ from the init type.
		{
			code: `declare function bar(): number;\nconst foo: any = bar();`,
			filename,
			name: "any annotation differs from concrete return type"
		},
		{
			code: `declare function bar(): number | undefined;\nconst foo: number = bar()!;`,
			filename,
			name: "non-null assertion is not in allowlist (skipped)"
		},
		{
			code: `type ID = string;\ndeclare function bar(): string;\nconst foo: ID = bar();`,
			filename,
			name: "alias annotation differs from underlying type"
		},
		{
			code: `declare function bar(): number;\nconst foo: number | undefined = bar();`,
			filename,
			name: "wider annotation than return type"
		},
		// No annotation, nothing to check.
		{
			code: `declare function bar(): number;\nconst foo = bar();`,
			filename,
			name: "no annotation"
		},
		// Destructuring is out of scope.
		{
			code: `declare const obj: { a: number };\nconst { a }: { a: number } = obj;`,
			filename,
			name: "destructuring pattern not handled"
		}
	]
});

console.log("no-redundant-type-annotation: All tests passed!");
