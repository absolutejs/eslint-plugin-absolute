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
		},
		{
			code: `function App() { const render = () => <><span>A</span><span>B</span></>; return <div />; }`,
			errors: [{ messageId: "nestedArrowFragment" }],
			name: "nested arrow function returning a non-singular fragment"
		},
		{
			code: `function App() { const render = function() { return <div><span>A</span></div>; }; return <div />; }`,
			errors: [{ messageId: "nestedFunctionJSX" }],
			name: "nested function expression returning non-component JSX with a child"
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
		},
		{
			code: `function App() { const render = () => <Ns.Component />; return <div />; }`,
			name: "nested arrow returning JSXMemberExpression component"
		},
		{
			code: `const App = function() { return <div />; }`,
			name: "top-level function expression component"
		}
	]
});

console.log("no-nested-jsx-return: All tests passed!");
