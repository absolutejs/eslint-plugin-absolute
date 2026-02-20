import { RuleTester } from "@typescript-eslint/rule-tester";
import { noNestedJSXReturn } from "../src/rules/no-nested-jsx-return";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-nested-jsx-return", noNestedJSXReturn, {
	invalid: [
		{
			code: `function App() { const render = () => <div><span>A</span><span>B</span></div>; return <div />; }`,
			errors: [{ messageId: "nestedArrowJSX" }],
			name: "nested arrow function returning non-component JSX with children"
		},
		{
			code: `function App() { function render() { return <div><span>A</span><span>B</span></div>; } return <div />; }`,
			errors: [{ messageId: "nestedFunctionJSX" }],
			name: "nested function with return of non-component non-singular JSX"
		}
	],
	valid: [
		{
			code: `function App() { return <div><span>Hello</span></div>; }`,
			name: "top-level function returning JSX"
		},
		{
			code: `function App() { const render = () => <MyComponent />; return <div />; }`,
			name: "nested function returning a single component element"
		},
		{
			code: `function App() { const render = () => <div />; return <div />; }`,
			name: "nested function returning singular JSX (empty element)"
		}
	]
});

console.log("no-nested-jsx-return: All tests passed!");
