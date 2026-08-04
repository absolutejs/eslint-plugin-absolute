import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { noUnsafeSchemaTypes } from "../src/rules/no-unsafe-schema-types";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
		sourceType: "module"
	}
});

ruleTester.run("no-unsafe-schema-types", noUnsafeSchemaTypes, {
	invalid: [
		{
			code: `import { t } from "elysia"; const body = t.Unknown();`,
			errors: [
				{ data: { method: "Unknown" }, messageId: "typeboxEscape" }
			]
		},
		{
			code: `import { Type as Schema } from "@sinclair/typebox"; const value = Schema.Any();`,
			errors: [{ data: { method: "Any" }, messageId: "typeboxEscape" }]
		},
		{
			code: `declare const jsonb: (name: string) => { $type<T>(): unknown }; const data = jsonb("data").$type<Record<string, unknown>>();`,
			errors: [{ messageId: "drizzleType" }]
		},
		{
			code: `declare const jsonb: (name: string) => { $type<T>(): unknown }; const data = jsonb("data").$type<any>();`,
			errors: [{ messageId: "drizzleType" }]
		}
	],
	valid: [
		`import { t } from "elysia"; const body = t.Object({ value: t.String() });`,
		`declare const jsonb: (name: string) => { $type<T>(): unknown }; type ProfileData = { strengths?: string[] }; const data = jsonb("data").$type<ProfileData>();`,
		`const service = { Unknown: () => "known" }; service.Unknown();`
	]
});

console.log("no-unsafe-schema-types: All tests passed!");
