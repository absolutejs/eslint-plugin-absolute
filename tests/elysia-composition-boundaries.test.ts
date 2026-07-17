import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { elysiaCompositionBoundaries } from "../src/rules/elysia-composition-boundaries";

const ruleTester = new RuleTester({
	languageOptions: { parser: parser.parser }
});

ruleTester.run("elysia-composition-boundaries", elysiaCompositionBoundaries, {
	invalid: [
		{
			code: `import { Elysia } from "elysia";
const publicApp = new Elysia().get("/", () => "ok");
const adminApp = publicApp.get("/admin", () => "admin");`,
			errors: [
				{
					data: { source: "publicApp" },
					messageId: "independentRouteApp"
				}
			],
			name: "rejects extending a previous route application"
		},
		{
			code: `import { Elysia } from "elysia";
const app = new Elysia().use(auth).use(metrics).get("/", () => "ok");`,
			errors: [{ messageId: "preferUseArray" }],
			name: "fixes adjacent plugin composition",
			output: `import { Elysia } from "elysia";
const app = new Elysia().use([auth, metrics]).get("/", () => "ok");`
		},
		{
			code: `import { Elysia as ServerApp } from "elysia";
const app = new ServerApp().use(first).use(second).use(third);`,
			errors: [{ messageId: "preferUseArray" }],
			name: "supports aliased Elysia imports and multiple plugins",
			output: `import { Elysia as ServerApp } from "elysia";
const app = new ServerApp().use([first, second, third]);`
		},
		{
			code: `import { Elysia } from "elysia";
const app = new Elysia()
  .use(first)
  // lifecycle ordering rationale
  .use(second);`,
			errors: [{ messageId: "preferUseArray" }],
			name: "does not autofix across comments"
		}
	],
	valid: [
		{
			code: `import { Elysia } from "elysia";
const publicApp = new Elysia({ name: "public" }).use([auth, metrics]).get("/", () => "ok");
const adminApp = new Elysia({ name: "admin" }).use(auth).get("/admin", () => "admin");`,
			name: "accepts independent named route applications"
		},
		{
			code: `const builder = createBuilder();
const second = builder.get("value");`,
			name: "ignores non-Elysia fluent builders"
		},
		{
			code: `import { Elysia } from "elysia";
const platform = new Elysia();
const server = platform.use(networking).onStop(close);`,
			name: "allows a terminal lifecycle composition without new routes"
		}
	]
});

console.log("elysia-composition-boundaries: All tests passed!");
