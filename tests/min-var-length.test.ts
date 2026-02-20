import { RuleTester } from "@typescript-eslint/rule-tester";
import { minVarLength } from "../src/rules/min-var-length";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("min-var-length", minVarLength, {
	invalid: [
		{
			code: `const x = 1;`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "variable name too short",
			options: [{ minLength: 3 }]
		},
		{
			code: `function fn(x) { return x; }`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "function parameter too short",
			options: [{ minLength: 3 }]
		}
	],
	valid: [
		{
			code: `const foo = 1;`,
			name: "variable name meets minimum length",
			options: [{ minLength: 3 }]
		},
		{
			code: `const x = 1;`,
			name: "short name allowed by allowedVars",
			options: [{ allowedVars: ["x"], minLength: 3 }]
		},
		{
			code: `try {} catch (e) { console.log(e); }`,
			name: "short name in catch clause",
			options: [{ minLength: 1 }]
		},
		{
			code: `const x = 1;`,
			name: "default minLength of 1 allows single char"
		}
	]
});

console.log("min-var-length: All tests passed!");
