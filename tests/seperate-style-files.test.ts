import { RuleTester } from "@typescript-eslint/rule-tester";
import { seperateStyleFiles } from "../src/rules/seperate-style-files";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("seperate-style-files", seperateStyleFiles, {
	invalid: [
		{
			code: `const wrapper: CSSProperties = { display: "flex" };`,
			errors: [
				{
					data: { name: "wrapper", typeName: "CSSProperties" },
					messageId: "moveToFile"
				}
			],
			filename: "Component.tsx",
			name: "CSSProperties typed variable in tsx file"
		},
		{
			code: `const container: React.CSSProperties = { padding: 10 };`,
			errors: [
				{
					data: { name: "container", typeName: "CSSProperties" },
					messageId: "moveToFile"
				}
			],
			filename: "Layout.tsx",
			name: "React.CSSProperties typed variable in tsx file"
		},
		{
			code: `const header: CSSProperties = { fontSize: 24 };`,
			errors: [
				{
					data: { name: "header", typeName: "CSSProperties" },
					messageId: "moveToFile"
				}
			],
			filename: "Header.jsx",
			name: "CSSProperties typed variable in jsx file"
		}
	],
	valid: [
		{
			code: `const style: CSSProperties = { color: "red" };`,
			filename: "utils.ts",
			name: "CSSProperties in a non-tsx file is ignored"
		},
		{
			code: `const style = { color: "red" };`,
			filename: "Component.tsx",
			name: "variable without CSSProperties type in tsx file"
		},
		{
			code: `const config: AppConfig = { theme: "dark" };`,
			filename: "Component.tsx",
			name: "variable with a different type annotation in tsx"
		},
		{
			code: `const style: CSSProperties = { color: "red" };`,
			filename: "helper.ts",
			name: "CSSProperties in a non-jsx file is ignored"
		}
	]
});

console.log("seperate-style-files: All tests passed!");
