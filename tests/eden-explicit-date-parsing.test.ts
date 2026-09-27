import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { edenExplicitDateParsing } from "../src/rules/eden-explicit-date-parsing";
const tester = new RuleTester({ languageOptions: { parser: tsParser } });
tester.run("eden-explicit-date-parsing", edenExplicitDateParsing, {
	valid: [
		`import { treaty } from "@elysia/eden"; treaty(url, { parseDate: false });`,
		`import { treaty as client } from "@elysia/eden"; client(url, { parseDate: true });`,
		`import * as eden from "@elysiajs/eden"; eden.treaty(url, { ...config, parseDate: false });`,
		`import { treaty } from "other"; treaty(url);`,
		`import { treaty } from "@elysia/eden"; function scoped(treaty) { treaty(url); }`,
		`import { treaty } from "@elysia/eden"; treaty(url, config);`
	],
	invalid: [
		`import { treaty } from "@elysia/eden"; treaty(url);`,
		`import { treaty as client } from "@elysia/eden"; client<App>(url, { fetch: { credentials: "include" } });`,
		`import * as eden from "@elysiajs/eden"; eden.treaty(url, {});`,
		`import { treaty } from "@elysia/eden"; treaty(url, { parseDate: false, ...config });`,
		`import { treaty } from "@elysia/eden"; treaty(url, { parseDate: undefined });`
	].map((code) => ({
		code,
		errors: [{ messageId: "explicitDateParsing" as const }]
	}))
});
