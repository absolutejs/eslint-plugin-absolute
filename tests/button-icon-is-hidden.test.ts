import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "@typescript-eslint/parser";
import { buttonIconIsHidden } from "../src/rules/button-icon-is-hidden";

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: { ecmaVersion: 2022, sourceType: "module" }
	}
});

ruleTester.run("button-icon-is-hidden", buttonIconIsHidden, {
	invalid: [
		{
			code: `const template = '<button aria-label="Send"><span class="material-icons">send</span></button>';`,
			errors: [{ messageId: "iconNotHidden" }],
			name: "exposed Material Icons ligature is rejected",
			output: `const template = '<button aria-label="Send"><span class="material-icons" aria-hidden="true">send</span></button>';`
		}
	],
	valid: [
		{
			code: `const template = '<button aria-label="Send"><span class="material-icons" aria-hidden="true">send</span></button>';`,
			name: "hidden Material Icons ligature is accepted"
		},
		{
			code: `const template = '<button>Save</button>';`,
			name: "button without a Material Icon is ignored"
		}
	]
});
