import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { noInlinePropTypes } from "../src/rules/no-inline-prop-types";

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
			code: `function Component({ mode }: { mode: string }) { return null; }`,
			errors: [{ messageId: "noInlinePropTypes" }],
			name: "function with inline destructured props"
		},
		{
			code: `const Component = ({ count }: { count: number }) => null;`,
			errors: [{ messageId: "noInlinePropTypes" }],
			name: "arrow function with inline destructured props"
		}
	],
	valid: [
		{
			code: `type Props = { mode: string }; function Component({ mode }: Props) { return null; }`,
			name: "named props type"
		},
		{
			code: `function handler(options: { value: string }) { return options.value; }`,
			name: "non-destructured service parameter remains outside the narrow rule"
		},
		{
			code: `function handler({ value }: Props, options: { trace: boolean }) { return value; }`,
			name: "only the first destructured props parameter is checked"
		}
	]
});

console.log("no-inline-prop-types: All tests passed!");
