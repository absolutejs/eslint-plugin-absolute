import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUselessFunction } from "../src/rules/no-useless-function";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("no-useless-function", noUselessFunction, {
	invalid: [
		{
			code: `const fn = () => ({ a: 1 });`,
			errors: [{ messageId: "uselessFunction" }],
			name: "parameterless arrow returning object literal"
		}
	],
	valid: [
		{
			code: `const fn = (x) => ({ a: x });`,
			name: "arrow function with parameters"
		},
		{
			code: `const fn = () => 42;`,
			name: "arrow function returning non-object"
		},
		{
			code: `useSpring(() => ({ opacity: 1 }));`,
			name: "arrow function used as callback"
		},
		{
			code: `const fn = () => { return { a: 1 }; };`,
			name: "arrow function with block body"
		},
		{
			code: `someFunc(x, () => ({ a: 1 }));`,
			name: "arrow as second argument (callback)"
		}
	]
});

ruleTester.run("no-useless-function (standalone arrow)", noUselessFunction, {
	invalid: [
		{
			code: `const fn = () => ({ a: 1 });`,
			errors: [{ messageId: "uselessFunction" }],
			name: "arrow as non-argument (standalone) is invalid"
		}
	],
	valid: []
});

console.log("no-useless-function: All tests passed!");
