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
		},
		{
			code: `const C = () => <div>{flag && <span><a href="#">link</a></span>}</div>;`,
			name: "JSX in expression container within limit",
			options: [3]
		}
	]
});

ruleTester.run("max-jsx-nesting (fragment and deep nesting)", maxJSXNesting, {
	invalid: [
		{
			code: `const C = () => <><div><span /></div></>;`,
			errors: [{ messageId: "tooDeeplyNested" }],
			name: "JSXFragment nesting: fragment counts as a level",
			options: [2]
		},
		{
			code: `const C = () => <div><section><span><a href="#">link</a></span></section></div>;`,
			errors: [
				{ messageId: "tooDeeplyNested" },
				{ messageId: "tooDeeplyNested" },
				{ messageId: "tooDeeplyNested" }
			],
			name: "deeply nested 4 levels: all exceeding elements reported (maxAllowed=1)",
			options: [1]
		},
		{
			code: `const C = () => <div>{flag && <span><a href="#">link</a></span>}</div>;`,
			errors: [
				{ messageId: "tooDeeplyNested" },
				{ messageId: "tooDeeplyNested" }
			],
			name: "JSX in expression container exceeding limit",
			options: [1]
		}
	],
	valid: []
});

console.log("max-jsx-nesting: All tests passed!");
