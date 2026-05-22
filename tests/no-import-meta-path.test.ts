import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { noImportMetaPath } from "../src/rules/no-import-meta-path";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
		sourceType: "module"
	}
});

ruleTester.run("no-import-meta-path", noImportMetaPath, {
	invalid: [
		{
			code: `const dir = import.meta.dir;`,
			errors: [
				{ data: { property: "dir" }, messageId: "importMetaPath" }
			],
			name: "import.meta.dir (Bun)"
		},
		{
			code: `const dir = import.meta.dirname;`,
			errors: [
				{ data: { property: "dirname" }, messageId: "importMetaPath" }
			],
			name: "import.meta.dirname (Node)"
		},
		{
			code: `const file = import.meta.filename;`,
			errors: [
				{ data: { property: "filename" }, messageId: "importMetaPath" }
			],
			name: "import.meta.filename (Node)"
		},
		{
			code: `const root = resolve(import.meta.dir, "..", "data");`,
			errors: [
				{ data: { property: "dir" }, messageId: "importMetaPath" }
			],
			name: "import.meta.dir passed to a path resolver"
		},
		{
			code: `import { fileURLToPath } from "node:url";\nconst p = fileURLToPath(import.meta.url);`,
			errors: [{ messageId: "importMetaUrl" }],
			name: "fileURLToPath(import.meta.url)"
		},
		{
			code: `import { fileURLToPath } from "node:url";\nimport { dirname } from "node:path";\nconst d = dirname(fileURLToPath(import.meta.url));`,
			errors: [{ messageId: "importMetaUrl" }],
			name: "dirname(fileURLToPath(import.meta.url))"
		},
		{
			code: `import url from "node:url";\nconst p = url.fileURLToPath(import.meta.url);`,
			errors: [{ messageId: "importMetaUrl" }],
			name: "url.fileURLToPath(import.meta.url) member call"
		}
	],
	valid: [
		{
			code: `const asset = new URL("./asset.js", import.meta.url);`,
			name: "new URL(relative, import.meta.url) asset reference is bundler-safe"
		},
		{
			code: `const mode = import.meta.env;`,
			name: "import.meta.env is not a filesystem path"
		},
		{
			code: `const here = import.meta.url;`,
			name: "bare import.meta.url (not converted to a path) is allowed"
		},
		{
			code: `import { projectRoot } from "@absolutejs/absolute";\nconst dbPath = resolve(projectRoot, "app.sqlite");`,
			name: "projectRoot anchor is the recommended replacement"
		},
		{
			code: `const base = process.cwd();`,
			name: "process.cwd() is allowed"
		},
		{
			code: `const dir = settings.dir;`,
			name: "a .dir property on something other than import.meta"
		},
		{
			code: `import { fileURLToPath } from "node:url";\nconst p = fileURLToPath(someUrl);`,
			name: "fileURLToPath of a non-import.meta URL is allowed"
		}
	]
});

console.log("no-import-meta-path: All tests passed!");
