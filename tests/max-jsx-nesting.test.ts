import { RuleTester } from "@typescript-eslint/rule-tester";
import { maxJSXNesting } from "../src/rules/max-jsx-nesting";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("max-jsx-nesting", maxJSXNesting, {
	invalid: [
		{
			code: `const C = () => <div><section><span /></section></div>;`,
			errors: [{ messageId: "tooDeeplyNested" }],
			name: "nesting exceeds limit of 2",
			options: [2]
		},
		{
			code: `const C = () => <div><span /></div>;`,
			errors: [{ messageId: "tooDeeplyNested" }],
			name: "deeply nested exceeds limit of 1",
			options: [1]
		}
	],
	valid: [
		{
			code: `const C = () => <div><span /></div>;`,
			name: "single level JSX (maxAllowed=2)",
			options: [2]
		},
		{
			code: `const C = () => <div><section><span /></section></div>;`,
			name: "exactly at limit (maxAllowed=3)",
			options: [3]
		}
	]
});

console.log("max-jsx-nesting: All tests passed!");
