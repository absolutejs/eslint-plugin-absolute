import { RuleTester } from "@typescript-eslint/rule-tester";
import { noTransitionCSSProperties } from "../src/rules/no-transition-cssproperties";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("no-transition-cssproperties", noTransitionCSSProperties, {
	invalid: [
		{
			code: `const style: CSSProperties = { transition: "all 0.3s", color: "red" };`,
			errors: [{ messageId: "forbiddenTransition" }],
			name: "CSSProperties object with transition property"
		},
		{
			code: `const style: React.CSSProperties = { transition: "opacity 0.5s" };`,
			errors: [{ messageId: "forbiddenTransition" }],
			name: "React.CSSProperties with transition"
		}
	],
	valid: [
		{
			code: `const style: CSSProperties = { color: "red", fontSize: 14 };`,
			name: "CSSProperties object without transition"
		},
		{
			code: `const style = { transition: "all 0.3s" };`,
			name: "non-CSSProperties object with transition"
		},
		{
			code: `let style: CSSProperties;`,
			name: "CSSProperties variable without initializer"
		}
	]
});

ruleTester.run("no-transition-cssproperties (additional cases)", noTransitionCSSProperties, {
	invalid: [
		{
			code: `const s: CSSProperties = { ...base, transition: "all" };`,
			errors: [{ messageId: "forbiddenTransition" }],
			name: "spread element in object with transition property"
		},
		{
			code: `const s: CSSProperties = { transition: "all 0.3s", transitionDelay: "0s" };`,
			errors: [{ messageId: "forbiddenTransition" }],
			name: "multiple transition properties in one object (only transition flagged)"
		}
	],
	valid: []
});

console.log("no-transition-cssproperties: All tests passed!");
