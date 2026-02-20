import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUnnecessaryKey } from "../src/rules/no-unnecessary-key";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("no-unnecessary-key", noUnnecessaryKey, {
	valid: [
		{
			name: "key inside .map() callback",
			code: `const C = () => items.map(item => <div key={item.id}>{item.name}</div>);`
		},
		{
			name: "element without key prop",
			code: `const C = () => <div>Hello</div>;`
		},
		{
			name: "key inside function return statement",
			code: `function renderItem() { return <div key="a">Hello</div>; }`
		}
	],
	invalid: [
		{
			name: "key on element not in map or return",
			code: `const C = () => <div key="a">Hello</div>;`,
			errors: [{ messageId: "unnecessaryKey" }]
		}
	]
});

console.log("no-unnecessary-key: All tests passed!");
