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
		}
	]
});

console.log("no-unnecessary-key: All tests passed!");
