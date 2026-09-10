import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { timestampWithTimezone } from "../src/rules/timestamp-with-timezone";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("timestamp-with-timezone", timestampWithTimezone, {
	invalid: [
		{
			code: `const t = pgTable("a", { created_at: timestamp() });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "no arguments at all",
			output: `const t = pgTable("a", { created_at: timestamp({ withTimezone: true }) });`
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp({ mode: "date" }) });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "settings that say nothing about the zone",
			output: `const t = pgTable("a", { created_at: timestamp({ mode: "date", withTimezone: true }) });`
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp("created_at") });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "a named column with no settings",
			output: `const t = pgTable("a", { created_at: timestamp("created_at", { withTimezone: true }) });`
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp("created_at", { mode: "date" }) });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "a named column whose settings omit it",
			output: `const t = pgTable("a", { created_at: timestamp("created_at", { mode: "date", withTimezone: true }) });`
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp({ withTimezone: false }) });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "the zone turned off on purpose is still a naive column",
			output: `const t = pgTable("a", { created_at: timestamp({ withTimezone: false, withTimezone: true }) });`
		},
		{
			/* A spread might carry the zone, and might not. Appending wins
			   either way -- a later key overrides -- so this is reported and
			   fixed rather than guessed about. */
			code: `const t = pgTable("a", { created_at: timestamp({ ...shared }) });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "settings spread in from elsewhere",
			output: `const t = pgTable("a", { created_at: timestamp({ ...shared, withTimezone: true }) });`
		},
		{
			code: `const t = pgTable("a", { at: timestamp().notNull().defaultNow() });`,
			errors: [{ messageId: "timestampNeedsZone" }],
			name: "a chained column",
			output: `const t = pgTable("a", { at: timestamp({ withTimezone: true }).notNull().defaultNow() });`
		}
	],
	valid: [
		{
			code: `const t = pgTable("a", { created_at: timestamp({ withTimezone: true }) });`,
			name: "already zoned"
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp({ mode: "date", precision: 3, withTimezone: true }) });`,
			name: "zoned alongside other settings"
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp("created_at", { withTimezone: true }) });`,
			name: "a named column, zoned"
		},
		{
			// A birthday is a wall clock, not an instant. Only `timestamp` is
			// this rule's business.
			code: `const t = pgTable("a", { born_on: date(), opens_at: time() });`,
			name: "date and time columns are left alone"
		},
		{
			code: `const shifted = timestamp;`,
			name: "the identifier used as a value, not called"
		},
		{
			code: `const t = pgTable("a", { created_at: timestamp(shared) });`,
			name: "settings passed as a variable, which cannot be read here"
		}
	]
});
