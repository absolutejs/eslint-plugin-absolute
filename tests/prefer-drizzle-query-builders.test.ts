import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { preferDrizzleQueryBuilders } from "../src/rules/prefer-drizzle-query-builders";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
		parserOptions: {
			projectService: { allowDefaultProject: ["file.ts"] },
			tsconfigRootDir: `${import.meta.dir}/..`
		},
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
		},
		{
			code: `import { sql } from "drizzle-orm"; const scopes: string[] = ["openid"]; const value = sql\`CASE WHEN \${active} THEN \${scopes} ELSE \${tokens.scopes} END\`;`,
			errors: [{ messageId: "directArray" }]
		},
		{
			code: `import { sql } from "drizzle-orm"; const scopes = ["openid"] as const; const value = sql\`CASE WHEN \${active} THEN \${scopes} ELSE \${tokens.scopes} END\`;`,
			errors: [{ messageId: "directArray" }]
		}
	],
	valid: [
		`import { eq } from "drizzle-orm"; const where = eq(users.id, id);`,
		`import { sql } from "drizzle-orm"; const count = sql<number>\`count(*)\`;`,
		`import { max } from "drizzle-orm"; const rows = db.select({ latest: max(users.createdAt) });`,
		`import { sql } from "drizzle-orm"; const rows = db.select({ latest: sql\`max(\${users.createdAt}) filter (where \${users.kind} = 'reply')\`.mapWith(users.createdAt) });`,
		`import { sql } from "drizzle-orm"; const scopes: string[] = ["openid"]; const value = sql\`CASE WHEN \${active} THEN \${sql.param(scopes, tokens.scopes)} ELSE \${tokens.scopes} END\`;`,
		`import { sql } from "drizzle-orm"; const values: string[] = ["a"]; const list = sql.join(values.map((value) => sql\`\${value}\`), sql\`, \`);`,
		`const rows = await db.select().from(runs);`,
		`import { sql } from "other-package"; const fragment = sql\`\${left} = \${right}\`;`
	]
});

console.log("prefer-drizzle-query-builders: All tests passed!");
