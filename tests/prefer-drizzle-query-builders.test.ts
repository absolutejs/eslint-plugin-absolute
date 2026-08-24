import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { preferDrizzleQueryBuilders } from "../src/rules/prefer-drizzle-query-builders";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
		sourceType: "module"
	}
});

ruleTester.run("prefer-drizzle-query-builders", preferDrizzleQueryBuilders, {
	invalid: [
		{
			code: `import { sql } from "drizzle-orm"; const where = sql\`\${users.id} = \${id}\`;`,
			errors: [{ data: { builder: "eq" }, messageId: "preferBuilder" }]
		},
		{
			code: `import { sql as query } from "drizzle-orm"; const where = query\`\${users.deletedAt} is null\`;`,
			errors: [
				{ data: { builder: "isNull" }, messageId: "preferBuilder" }
			]
		},
		{
			code: `import { sql } from "drizzle-orm"; const fragment = sql.raw(input);`,
			errors: [{ messageId: "rawSql" }]
		},
		{
			code: `const rows = await client.unsafe<Row[]>("SELECT created_at FROM runs");`,
			errors: [{ messageId: "unsafeQuery" }]
		},
		{
			code: `const rows = await client["unsafe"]("SELECT * FROM runs");`,
			errors: [{ messageId: "unsafeQuery" }]
		},
		{
			code: `import { sql } from "drizzle-orm"; const rows = db.select({ createdAt: sql<Date>\`\${users.createdAt}\` });`,
			errors: [{ messageId: "directColumn" }]
		},
		{
			code: `import { sql } from "drizzle-orm"; const rows = db.select({ latest: sql<Date | null>\`max(\${users.createdAt})\` });`,
			errors: [{ messageId: "unmappedDate" }]
		}
	],
	valid: [
		`import { eq } from "drizzle-orm"; const where = eq(users.id, id);`,
		`import { sql } from "drizzle-orm"; const count = sql<number>\`count(*)\`;`,
		`import { max } from "drizzle-orm"; const rows = db.select({ latest: max(users.createdAt) });`,
		`import { sql } from "drizzle-orm"; const rows = db.select({ latest: sql\`max(\${users.createdAt}) filter (where \${users.kind} = 'reply')\`.mapWith(users.createdAt) });`,
		`const rows = await db.select().from(runs);`,
		`import { sql } from "other-package"; const fragment = sql\`\${left} = \${right}\`;`
	]
});

console.log("prefer-drizzle-query-builders: All tests passed!");
