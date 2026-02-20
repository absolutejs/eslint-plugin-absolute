import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUnnecessaryDiv } from "../src/rules/no-unnecessary-div";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("no-unnecessary-div", noUnnecessaryDiv, {
	valid: [
		{
			name: "div with multiple children",
			code: `const C = () => <div><span /><span /></div>;`
		},
		{
			name: "div with text content",
			code: `const C = () => <div>Hello</div>;`
		},
		{
			name: "div with no children",
			code: `const C = () => <div />;`
		},
		{
			name: "non-div element wrapping single child",
			code: `const C = () => <section><span /></section>;`
		},
		{
			name: "div with single expression child (not JSX element)",
			code: `const C = () => <div>{value}</div>;`
		}
	],
	invalid: [
		{
			name: "div wrapping a single JSX element",
			code: `const C = () => <div><span /></div>;`,
			errors: [{ messageId: "unnecessaryDivWrapper" }]
		},
		{
			name: "div wrapping a single JSX element with whitespace",
			code: `const C = () => <div>
				<span />
			</div>;`,
			errors: [{ messageId: "unnecessaryDivWrapper" }]
		}
	]
});

console.log("no-unnecessary-div: All tests passed!");
