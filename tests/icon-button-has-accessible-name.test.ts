import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "@typescript-eslint/parser";
import { iconButtonHasAccessibleName } from "../src/rules/icon-button-has-accessible-name";

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: { ecmaVersion: 2022, sourceType: "module" }
	}
});

ruleTester.run("icon-button-has-accessible-name", iconButtonHasAccessibleName, {
	invalid: [
		{
			code: `const template = '<button title="Send"><span class="material-icons">send</span></button>';`,
			errors: [{ messageId: "missingAccessibleName" }],
			name: "title and raw ligature are rejected",
			output: `const template = '<button title="Send" aria-label="Send"><span class="material-icons">send</span></button>';`
		}
	],
	valid: [
		{
			code: `const template = '<button aria-label="Send"><span class="material-icons" aria-hidden="true">send</span></button>';`,
			name: "explicit accessible name is accepted"
		},
		{
			code: `const template = '<button>Save</button>';`,
			name: "visible text is accepted"
		}
	]
});
