import { RuleTester } from "@typescript-eslint/rule-tester";
import { noOrNoneComponent } from "../src/rules/no-or-none-component";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-or-none-component", noOrNoneComponent, {
	invalid: [
		{
			code: `const C = () => <div>{flag ? <A /> : null}</div>;`,
			errors: [{ messageId: "useLogicalAnd" }],
			name: "ternary with null alternate inside JSX child"
		},
		{
			code: `const C = () => <div>{flag ? <A /> : undefined}</div>;`,
			errors: [{ messageId: "useLogicalAnd" }],
			name: "ternary with undefined alternate inside JSX child"
		}
	],
	valid: [
		{
			code: `const C = () => <div>{flag ? <A /> : <B />}</div>;`,
			name: "ternary with actual alternate component"
		},
		{
			code: `const C = () => <Comp render={flag ? <A /> : null} />;`,
			name: "ternary with null but used as prop (JSXAttribute)"
		},
		{
			code: `const C = () => <div>{flag && <A />}</div>;`,
			name: "logical && expression"
		},
		{
			code: `const x = flag ? <A /> : null;`,
			name: "ternary with null outside JSX"
		}
	]
});

console.log("no-or-none-component: All tests passed!");
