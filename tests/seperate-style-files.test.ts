import { RuleTester } from "@typescript-eslint/rule-tester";
import { seperateStyleFiles } from "../src/rules/seperate-style-files";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("seperate-style-files", seperateStyleFiles, {
	valid: [
		{
			name: "CSSProperties in a non-tsx file is ignored",
			code: `const style: CSSProperties = { color: "red" };`,
			filename: "utils.ts"
		},
		{
			name: "variable without CSSProperties type in tsx file",
			code: `const style = { color: "red" };`,
			filename: "Component.tsx"
		},
		{
			name: "variable with a different type annotation in tsx",
			code: `const config: AppConfig = { theme: "dark" };`,
			filename: "Component.tsx"
		},
		{
			name: "CSSProperties in a non-jsx file is ignored",
			code: `const style: CSSProperties = { color: "red" };`,
			filename: "helper.ts"
		}
	],
	invalid: [
		{
			name: "CSSProperties typed variable in tsx file",
			code: `const wrapper: CSSProperties = { display: "flex" };`,
			filename: "Component.tsx",
			errors: [
				{
					messageId: "moveToFile",
					data: { name: "wrapper", typeName: "CSSProperties" }
				}
			]
		},
		{
			name: "React.CSSProperties typed variable in tsx file",
			code: `const container: React.CSSProperties = { padding: 10 };`,
			filename: "Layout.tsx",
			errors: [
				{
					messageId: "moveToFile",
					data: { name: "container", typeName: "CSSProperties" }
				}
			]
		},
		{
			name: "CSSProperties typed variable in jsx file",
			code: `const header: CSSProperties = { fontSize: 24 };`,
			filename: "Header.jsx",
			errors: [
				{
					messageId: "moveToFile",
					data: { name: "header", typeName: "CSSProperties" }
				}
			]
		}
	]
});

console.log("seperate-style-files: All tests passed!");
