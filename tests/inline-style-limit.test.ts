import { RuleTester } from "@typescript-eslint/rule-tester";
import { inlineStyleLimit } from "../src/rules/inline-style-limit";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("inline-style-limit", inlineStyleLimit, {
	invalid: [
		{
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3, d: 4 }} />;`,
			errors: [{ messageId: "extractStyle" }],
			name: "inline style exceeding maxKeys (number option)",
			options: [3]
		},
		{
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3 }} />;`,
			errors: [{ messageId: "extractStyle" }],
			name: "inline style exceeding maxKeys (object option)",
			options: [{ maxKeys: 2 }]
		}
	],
	valid: [
		{
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3 }} />;`,
			name: "inline style with keys at limit (maxKeys=3)",
			options: [3]
		},
		{
			code: `const C = () => <div style={{ a: 1 }} />;`,
			name: "inline style with fewer keys than limit",
			options: [3]
		},
		{
			code: `const C = () => <div data={{ a: 1, b: 2, c: 3, d: 4 }} />;`,
			name: "non-style attribute with object",
			options: [3]
		},
		{
			code: `const C = () => <div style={{ a: 1, b: 2 }} />;`,
			name: "style with object option format",
			options: [{ maxKeys: 2 }]
		},
		{
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3 }} />;`,
			name: "default option (no options): valid with 3 keys"
		},
		{
			code: `const C = () => <div style={{ ...base, a: 1 }} />;`,
			name: "spread elements in style are not counted as Property",
			options: [3]
		},
		{
			code: `const C = () => <div style={myVar} />;`,
			name: "non-object style value is valid",
			options: [3]
		}
	]
});

ruleTester.run("inline-style-limit (default option invalid)", inlineStyleLimit, {
	invalid: [
		{
			code: `const C = () => <div style={{ a: 1, b: 2, c: 3, d: 4 }} />;`,
			errors: [{ messageId: "extractStyle" }],
			name: "default option (no options): invalid with 4 keys"
		}
	],
	valid: []
});

console.log("inline-style-limit: All tests passed!");
