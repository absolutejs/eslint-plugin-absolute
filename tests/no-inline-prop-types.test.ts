import { RuleTester } from "@typescript-eslint/rule-tester";
import { noInlinePropTypes } from "../src/rules/no-inline-prop-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-inline-prop-types", noInlinePropTypes, {
	invalid: [
		{
			code: `function Comp({ mode }: { mode: string }) { return null; }`,
			errors: [{ messageId: "noInlinePropTypes" }],
			name: "function with inline object type for destructured props"
		},
		{
			code: `const Comp = ({ x }: { x: number }) => null;`,
			errors: [{ messageId: "noInlinePropTypes" }],
			name: "arrow function with inline object type"
		}
	],
	valid: [
		{
			code: `type Props = { mode: string }; function Comp({ mode }: Props) { return null; }`,
			name: "function with named type for props"
		},
		{
			code: `function Comp() { return null; }`,
			name: "function with no parameters"
		},
		{
			code: `type Props = { x: number }; const Comp = ({ x }: Props) => null;`,
			name: "arrow function with named type"
		}
	]
});

console.log("no-inline-prop-types: All tests passed!");
