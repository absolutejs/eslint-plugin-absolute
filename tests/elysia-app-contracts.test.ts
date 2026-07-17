import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { elysiaAppContracts } from "../src/rules/elysia-app-contracts";

const ruleTester = new RuleTester({
	languageOptions: { parser: parser.parser }
});

ruleTester.run("elysia-app-contracts", elysiaAppContracts, {
	invalid: [
		{
			code: `export const server = platform.use(networking);
export type Server = typeof server;`,
			errors: [{ messageId: "terminalServerType" }],
			filename: "src/backend/server.ts",
			name: "rejects a terminal server type"
		},
		{
			code: `export const adminApplication = createAdminApplication(dependencies);
export type AdminApplication = typeof adminApplication;`,
			errors: [
				{
					data: { directory: "src/backend/apps" },
					messageId: "applicationTypeLocation"
				}
			],
			filename: "src/backend/server.ts",
			name: "requires inferred app contracts to live in the app directory"
		},
		{
			code: `export type AdminApplication = ReturnType<typeof createAdminApplication>;`,
			errors: [{ messageId: "missingApplicationFactory" }],
			filename: "src/backend/apps/admin.app.ts",
			name: "requires an exported app factory"
		},
		{
			code: `export const createAdminApplication = () => new Elysia();`,
			errors: [{ messageId: "missingApplicationType" }],
			filename: "src/backend/apps/admin.app.ts",
			name: "requires an exported app type"
		}
	],
	valid: [
		{
			code: `export const server = platform.use(networking);`,
			filename: "src/backend/server.ts",
			name: "accepts an untyped terminal server value"
		},
		{
			code: `export const createAdminApplication = () => new Elysia();
export type AdminApplication = ReturnType<typeof createAdminApplication>;`,
			filename: "src/backend/apps/admin.app.ts",
			name: "accepts a complete isolated app contract"
		},
		{
			code: `export type ApplicationMetadata = { name: string };`,
			filename: "src/backend/server.ts",
			name: "ignores application domain types"
		},
		{
			code: `export const createAdminApplication = () => new Elysia();
export type AdminApplication = typeof adminApplication;`,
			filename: "packages/control-plane/routes/admin.app.ts",
			name: "supports configured app directories",
			options: [{ appDirectories: ["packages/control-plane/routes"] }]
		}
	]
});

console.log("elysia-app-contracts: All tests passed!");
