import { RuleTester } from "@typescript-eslint/rule-tester";
import { maxJSXNesting } from "../src/rules/max-jsx-nesting";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("max-jsx-nesting", maxJSXNesting, {
	valid: [
		{
			name: "single level JSX (maxAllowed=2)",
			code: `const C = () => <div><span /></div>;`,
			options: [2]
		},
		{
			name: "exactly at limit (maxAllowed=3)",
			code: `const C = () => <div><section><span /></section></div>;`,
			options: [3]
		}
	],
	invalid: [
		{
			name: "nesting exceeds limit of 2",
			code: `const C = () => <div><section><span /></section></div>;`,
			options: [2],
			errors: [{ messageId: "tooDeeplyNested" }]
		},
		{
			name: "deeply nested exceeds limit of 1",
			code: `const C = () => <div><span /></div>;`,
			options: [1],
			errors: [{ messageId: "tooDeeplyNested" }]
		}
	]
});

console.log("max-jsx-nesting: All tests passed!");
