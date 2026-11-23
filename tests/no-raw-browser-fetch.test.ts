import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { noRawBrowserFetch } from "../src/rules/no-raw-browser-fetch";

new RuleTester({ languageOptions: { parser: tsParser } }).run(
	"no-raw-browser-fetch",
	noRawBrowserFetch,
	{
		invalid: [
			"fetch(url)",
			"window.fetch(url)",
			"globalThis['fetch']?.(url)",
			"self.fetch(url)"
		].map((code) => ({ code, errors: [{ messageId: "rawFetch" }] })),
		valid: [
			"client.fetch(url)",
			"function request(fetch) { return fetch(url); }",
			"function request(window) { return window.fetch(url); }"
		]
	}
);
