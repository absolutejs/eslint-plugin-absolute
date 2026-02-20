import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUnnecessaryKey } from "../src/rules/no-unnecessary-key";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-unnecessary-key", noUnnecessaryKey, {
	invalid: [
		{
			code: `const C = () => <div key="a">Hello</div>;`,
			errors: [{ messageId: "unnecessaryKey" }],
			name: "key on element not in map or return"
		}
	],
	valid: [
		{
			code: `const C = () => items.map(item => <div key={item.id}>{item.name}</div>);`,
			name: "key inside .map() callback"
		},
		{
			code: `const C = () => <div>Hello</div>;`,
			name: "element without key prop"
		},
		{
			code: `function renderItem() { return <div key="a">Hello</div>; }`,
			name: "key inside function return statement"
		},
		{
			code: `const C = () => items.map(function(item) { return <div key={item.id} /> });`,
			name: "key inside .map() with FunctionExpression callback"
		},
		{
			code: `const C = () => items.map(item => <ul>{item.children.map(child => <li key={child.id}>{child.name}</li>)}</ul>);`,
			name: "key in nested map calls"
		}
	]
});

ruleTester.run("no-unnecessary-key (additional invalid)", noUnnecessaryKey, {
	invalid: [
		{
			code: `const C = () => { const el = <div key="a" />; return el; };`,
			errors: [{ messageId: "unnecessaryKey" }],
			name: "key outside map and outside return statement"
		}
	],
	valid: []
});

console.log("no-unnecessary-key: All tests passed!");
