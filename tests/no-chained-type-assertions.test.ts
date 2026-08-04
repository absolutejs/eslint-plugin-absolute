import { RuleTester } from "@typescript-eslint/rule-tester";
import tsParser from "@typescript-eslint/parser";
import { noChainedTypeAssertions } from "../src/rules/no-chained-type-assertions";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: tsParser,
		sourceType: "module"
	}
});

ruleTester.run("no-chained-type-assertions", noChainedTypeAssertions, {
	invalid: [
		{
			code: "const output = input as unknown as { id: string };",
			errors: [{ messageId: "chainedAssertion" }]
		},
		{
			code: "const output = input as any as string;",
			errors: [{ messageId: "chainedAssertion" }]
		}
	],
	valid: [
		"const output = input as { id: string };",
		"const output: { id: string } = input;"
	]
});

console.log("no-chained-type-assertions: All tests passed!");
