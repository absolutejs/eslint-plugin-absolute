import { RuleTester } from "@typescript-eslint/rule-tester";
import { minVarLength } from "../src/rules/min-var-length";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("min-var-length", minVarLength, {
	valid: [
		{
			name: "variable name meets minimum length",
			code: `const foo = 1;`,
			options: [{ minLength: 3 }]
		},
		{
			name: "short name allowed by allowedVars",
			code: `const x = 1;`,
			options: [{ minLength: 3, allowedVars: ["x"] }]
		},
		{
			name: "short name in catch clause",
			code: `try {} catch (e) { console.log(e); }`,
			options: [{ minLength: 1 }]
		},
		{
			name: "default minLength of 1 allows single char",
			code: `const x = 1;`
		}
	],
	invalid: [
		{
			name: "variable name too short",
			code: `const x = 1;`,
			options: [{ minLength: 3 }],
			errors: [{ messageId: "variableNameTooShort" }]
		},
		{
			name: "function parameter too short",
			code: `function fn(x) { return x; }`,
			options: [{ minLength: 3 }],
			errors: [{ messageId: "variableNameTooShort" }]
		}
	]
});

console.log("min-var-length: All tests passed!");
