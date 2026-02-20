import { RuleTester } from "@typescript-eslint/rule-tester";
import { inlineStyleLimit } from "../src/rules/inline-style-limit";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("inline-style-limit", inlineStyleLimit, {
	valid: [
		{
			name: "inline style with keys at limit (maxKeys=3)",
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3 }} />;`,
			options: [3]
		},
		{
			name: "inline style with fewer keys than limit",
			code: `const C = () => <div style={{ a: 1 }} />;`,
			options: [3]
		},
		{
			name: "non-style attribute with object",
			code: `const C = () => <div data={{ a: 1, b: 2, c: 3, d: 4 }} />;`,
			options: [3]
		},
		{
			name: "style with object option format",
			code: `const C = () => <div style={{ a: 1, b: 2 }} />;`,
			options: [{ maxKeys: 2 }]
		}
	],
	invalid: [
		{
			name: "inline style exceeding maxKeys (number option)",
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3, d: 4 }} />;`,
			options: [3],
			errors: [{ messageId: "extractStyle" }]
		},
		{
			name: "inline style exceeding maxKeys (object option)",
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3 }} />;`,
			options: [{ maxKeys: 2 }],
			errors: [{ messageId: "extractStyle" }]
		}
	]
});

console.log("inline-style-limit: All tests passed!");
