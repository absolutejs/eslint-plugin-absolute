import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { elysiaNoResponseReturn } from "../src/rules/elysia-no-response-return";

const ruleTester = new RuleTester({
	languageOptions: { parser: parser.parser }
});

ruleTester.run("elysia-no-response-return", elysiaNoResponseReturn, {
	invalid: [
		{
			code: `new Elysia().get("/users", () => Response.json({ users: [] }));`,
			errors: [{ messageId: "responseJson" }],
			name: "rejects Response.json from an inline route"
		},
		{
			code: `const missing = () => new Response(null, { status: 404 });
const handler = () => missing();
new Elysia().get("/users/:id", handler);`,
			errors: [{ messageId: "nativeResponse" }],
			name: "follows referenced route helpers"
		},
		{
			code: `new Elysia().get("/download", ({ cookie }) =>
		authorized(cookie, async () => new Response(stream)));`,
			errors: [{ messageId: "nativeResponse" }],
			name: "follows callback arguments passed through route wrappers"
		},
		{
			code: `new Elysia().route("POST", "/users", () => Response.json({ ok: true }));`,
			errors: [{ messageId: "responseJson" }],
			name: "understands the generic Elysia route signature"
		},
		{
			code: `const shared = () => new Response(stream);
new Elysia().get("/download", shared).get("/json", shared);`,
			errors: [{ messageId: "nativeResponse" }],
			name: "rejects a shared helper when any route is not allowlisted",
			options: [{ allowNativeResponsePaths: ["/download"] }]
		},
		{
			code: `new Elysia().get("/users", () => {
	const response = Response.json({ users: [] });
	return response;
});`,
			errors: [{ messageId: "responseJson" }],
			name: "follows a Response stored before it is returned"
		}
	],
	valid: [
		{
			code: `new Elysia()
	.get("/users", () => ({ users: [] }))
	.post("/users", ({ status }) => status("BAD_REQUEST"));`,
			name: "allows typed data and status"
		},
		{
			code: `new Elysia().get("/login", ({ redirect }) => redirect("/dashboard"));`,
			name: "allows Elysia redirects"
		},
		{
			code: `new Elysia().get("/download", () => new Response(stream));`,
			name: "allows an exact native streaming boundary",
			options: [{ allowNativeResponsePaths: ["/download"] }]
		},
		{
			code: `new Elysia().get("/inspect", async () => {
	const text = await new Response(stream).text();
	return { text };
});`,
			name: "ignores Response used to consume a stream instead of returning it"
		},
		{
			code: `new Elysia().get("/inspect", async () => {
	const response = new Response(stream);
	const text = await response.text();
	return { text };
});`,
			name: "ignores a stored Response that is consumed rather than returned"
		},
		{
			code: `const handler = () => Response.json({ ok: true });
router.mount("/protocol", handler);`,
			name: "leaves mounted Fetch protocol handlers alone"
		}
	]
});

console.log("elysia-no-response-return: All tests passed!");
