import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUselessFunction } from "../src/rules/no-useless-function";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("no-useless-function", noUselessFunction, {
	valid: [
		{
			name: "arrow function with parameters",
			code: `const fn = (x) => ({ a: x });`
		},
		{
			name: "arrow function returning non-object",
			code: `const fn = () => 42;`
		},
		{
			name: "arrow function used as callback",
			code: `useSpring(() => ({ opacity: 1 }));`
		},
		{
			name: "arrow function with block body",
			code: `const fn = () => { return { a: 1 }; };`
		}
	],
	invalid: [
		{
			name: "parameterless arrow returning object literal",
			code: `const fn = () => ({ a: 1 });`,
			errors: [{ messageId: "uselessFunction" }]
		}
	]
});

console.log("no-useless-function: All tests passed!");
