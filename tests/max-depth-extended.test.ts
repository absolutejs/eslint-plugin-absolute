import { RuleTester } from "@typescript-eslint/rule-tester";
import { maxDepthExtended } from "../src/rules/max-depth-extended";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("max-depth-extended", maxDepthExtended, {
	invalid: [
		{
			code: `function foo() { if (true) { if (true) { doSomething(); } } }`,
			errors: [{ messageId: "tooDeep" }],
			name: "nested blocks exceed depth of 1",
			options: [1]
		}
	],
	valid: [
		{
			code: `function foo() { if (true) { doSomething(); } }`,
			name: "single if block within allowed depth",
			options: [1]
		},
		{
			code: `function foo() { if (true) { if (!valid) { return; } doSomething(); } }`,
			name: "early exit block (return) is not counted",
			options: [1]
		},
		{
			code: `function foo() { if (true) { if (!valid) { throw new Error(); } } }`,
			name: "early exit block (throw) is not counted",
			options: [1]
		},
		{
			code: `function foo() { doSomething(); }`,
			name: "no nesting at all"
		}
	]
});

console.log("max-depth-extended: All tests passed!");
