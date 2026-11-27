import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { elysiaCompositionBoundaries } from "../src/rules/elysia-composition-boundaries";

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
/* Enough of Elysia's shape for the checker: an instance is an object with
 * methods; a function plugin is callable. */
const prelude = `declare class Elysia { use(plugin: Elysia | Elysia[] | ((app: Elysia) => Elysia)): Elysia; get(path: string, handler: () => string): Elysia }
declare const auth: Elysia;
declare const metrics: Elysia;
declare const networking: <A extends Elysia>(app: A) => A;
declare const openapi: () => Elysia | ((app: Elysia) => Elysia);
`;

ruleTester.run(
	"elysia-composition-boundaries (typed)",
	elysiaCompositionBoundaries,
	{
		invalid: [
			{
				code: `${prelude}const app = new Elysia().use(auth).use(metrics);`,
				errors: [{ messageId: "preferUseArray" }],
				filename,
				name: "two instances still compose into one array",
				output: `${prelude}const app = new Elysia().use([auth, metrics]);`
			}
		],
		valid: [
			{
				code: `${prelude}const app = new Elysia().use(openapi()).use(networking);`,
				filename,
				name: "function plugins have no array form, so their chain stays"
			},
			{
				code: `${prelude}const app = new Elysia().use(auth).use(networking);`,
				filename,
				name: "one function plugin in the chain is enough"
			}
		]
	}
);
