import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { elysiaRouteBoundaries } from "../src/rules/elysia-route-boundaries";

const ruleTester = new RuleTester({
	languageOptions: { parser: parser.parser }
});

ruleTester.run("elysia-route-boundaries", elysiaRouteBoundaries, {
	invalid: [
		{
			code: `import { Elysia } from "elysia";
const finalGraph = new Elysia().use(networking);
export type Whatever = typeof finalGraph;`,
			errors: [{ messageId: "terminalGraphType" }],
			filename: "src/backend/server.ts",
			name: "rejects a terminal graph type without relying on names"
		},
		{
			code: `const purple = dependencies.make().get("/admin", () => "ok");`,
			errors: [
				{
					data: { directory: "src/backend/routes" },
					messageId: "routeSurfaceLocation"
				}
			],
			filename: "src/backend/server.ts",
			name: "detects route surfaces from HTTP semantics"
		},
		{
			code: `export const weave = () => dependencies.make().get("/users", () => []);`,
			errors: [
				{
					data: { symbol: "weave" },
					messageId: "missingRouteContract"
				}
			],
			filename: "src/backend/routes/users.ts",
			name: "requires a contract for the actual exported route symbol"
		},
		{
			code: `export const anything = () => dependencies.make().get("/users", () => []);
export type PublicSurface = ReturnType<typeof anything>;`,
			errors: [
				{ messageId: "routeSurfaceLocation" },
				{ messageId: "routeContractLocation" }
			],
			filename: "src/backend/server.ts",
			name: "places inferred contracts with their semantic route surface"
		}
	],
	valid: [
		{
			code: `export const whatever = () => dependencies.make().get("/health", () => "ok");`,
			filename: "src/backend/utils/health.ts",
			name: "allows route factories outside configured composition entrypoints"
		},
		{
			code: `export const weave = () => dependencies.make().get("/users", () => []);
export type PublicSurface = ReturnType<typeof weave>;`,
			filename: "src/backend/routes/users.ts",
			name: "accepts arbitrary names and filenames"
		},
		{
			code: `export const banana = () => dependencies.make().post("/fruit", () => "ok");
export type Peel = ReturnType<typeof banana>;`,
			filename: "packages/control-plane/http/purple.ts",
			name: "supports a configured directory without suffix conventions",
			options: [{ routeDirectories: ["packages/control-plane/http"] }]
		},
		{
			code: `const Application = { label: "domain value" };
export type Server = typeof Application;`,
			filename: "src/backend/server.ts",
			name: "ignores keyword-shaped non-Elysia values"
		},
		{
			code: `const builder = createBuilder();
const result = builder.get("value");`,
			filename: "src/backend/server.ts",
			name: "ignores non-route fluent builders"
		}
	]
});

console.log("elysia-route-boundaries: All tests passed!");
