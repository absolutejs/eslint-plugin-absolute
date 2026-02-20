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
		},
		{
			code: `const foo = () => { if (true) { if (true) { doSomething(); } } }`,
			errors: [{ messageId: "tooDeep" }],
			name: "arrow function with nesting exceeding depth of 1",
			options: [1]
		},
		{
			code: `const foo = function() { if (true) { if (true) { doSomething(); } } }`,
			errors: [{ messageId: "tooDeep" }],
			name: "function expression with nesting exceeding depth of 1",
			options: [1]
		},
		{
			code: `function foo() { if (true) { if (true) { if (true) { doSomething(); } } } }`,
			errors: [{ messageId: "tooDeep" }],
			name: "3-level nesting exceeds custom maxDepth of 2",
			options: [2]
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
		},
		{
			code: `function foo() { if (true) { if (true) { doSomething(); } } }`,
			name: "2-level nesting within custom maxDepth of 2",
			options: [2]
		},
		{
			code: `function outer() { if (true) { function inner() { if (true) { doSomething(); } } } }`,
			name: "nested function resets depth counter",
			options: [1]
		}
	]
});

console.log("max-depth-extended: All tests passed!");
