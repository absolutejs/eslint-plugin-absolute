import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUnnecessaryDiv } from "../src/rules/no-unnecessary-div";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-unnecessary-div", noUnnecessaryDiv, {
	invalid: [
		{
			code: `const C = () => <div><span /></div>;`,
			errors: [{ messageId: "unnecessaryDivWrapper" }],
			name: "div wrapping a single JSX element"
		},
		{
			code: `const C = () => <div>
				<span />
			</div>;`,
			errors: [{ messageId: "unnecessaryDivWrapper" }],
			name: "div wrapping a single JSX element with whitespace"
		}
	],
	valid: [
		{
			code: `const C = () => <div><span /><span /></div>;`,
			name: "div with multiple children"
		},
		{
			code: `const C = () => <div>Hello</div>;`,
			name: "div with text content"
		},
		{
			code: `const C = () => <div />;`,
			name: "div with no children"
		},
		{
			code: `const C = () => <section><span /></section>;`,
			name: "non-div element wrapping single child"
		},
		{
			code: `const C = () => <div>{value}</div>;`,
			name: "div with single expression child (not JSX element)"
		},
		{
			code: `const C = () => <div><></></div>;`,
			name: "div wrapping fragment (child is fragment not element)"
		}
	]
});

ruleTester.run("no-unnecessary-div (additional cases)", noUnnecessaryDiv, {
	invalid: [
		{
			code: `const C = () => <div className="wrapper"><span /></div>;`,
			errors: [{ messageId: "unnecessaryDivWrapper" }],
			name: "div with attributes wrapping single JSX element"
		},
		{
			code: `const C = () => <div><div><span /></div></div>;`,
			errors: [
				{ messageId: "unnecessaryDivWrapper" },
				{ messageId: "unnecessaryDivWrapper" }
			],
			name: "multiple nested unnecessary divs"
		}
	],
	valid: []
});

console.log("no-unnecessary-div: All tests passed!");
