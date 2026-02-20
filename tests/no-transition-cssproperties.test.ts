import { RuleTester } from "@typescript-eslint/rule-tester";
import { noTransitionCSSProperties } from "../src/rules/no-transition-cssproperties";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parser: parser.parser
	}
});

ruleTester.run("no-transition-cssproperties", noTransitionCSSProperties, {
	valid: [
		{
			name: "CSSProperties object without transition",
			code: `const style: CSSProperties = { color: "red", fontSize: 14 };`
		},
		{
			name: "non-CSSProperties object with transition",
			code: `const style = { transition: "all 0.3s" };`
		},
		{
			name: "CSSProperties variable without initializer",
			code: `let style: CSSProperties;`
		}
	],
	invalid: [
		{
			name: "CSSProperties object with transition property",
			code: `const style: CSSProperties = { transition: "all 0.3s", color: "red" };`,
			errors: [{ messageId: "forbiddenTransition" }]
		},
		{
			name: "React.CSSProperties with transition",
			code: `const style: React.CSSProperties = { transition: "opacity 0.5s" };`,
			errors: [{ messageId: "forbiddenTransition" }]
		}
	]
});

console.log("no-transition-cssproperties: All tests passed!");
