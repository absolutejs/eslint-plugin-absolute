import { RuleTester } from "@typescript-eslint/rule-tester";
import { noInlinePropTypes } from "../src/rules/no-inline-prop-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("no-inline-prop-types", noInlinePropTypes, {
	valid: [
		{
			name: "function with named type for props",
			code: `type Props = { mode: string }; function Comp({ mode }: Props) { return null; }`
		},
		{
			name: "function with no parameters",
			code: `function Comp() { return null; }`
		},
		{
			name: "arrow function with named type",
			code: `type Props = { x: number }; const Comp = ({ x }: Props) => null;`
		}
	],
	invalid: [
		{
			name: "function with inline object type for destructured props",
			code: `function Comp({ mode }: { mode: string }) { return null; }`,
			errors: [{ messageId: "noInlinePropTypes" }]
		},
		{
			name: "arrow function with inline object type",
			code: `const Comp = ({ x }: { x: number }) => null;`,
			errors: [{ messageId: "noInlinePropTypes" }]
		}
	]
});

console.log("no-inline-prop-types: All tests passed!");
