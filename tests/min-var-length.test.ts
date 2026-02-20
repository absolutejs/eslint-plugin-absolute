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
		},
		{
			code: `const { x } = obj;`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "destructured object pattern with short name",
			options: [{ minLength: 3 }]
		},
		{
			code: `const [x, y] = arr;`,
			errors: [
				{ messageId: "variableNameTooShort" },
				{ messageId: "variableNameTooShort" }
			],
			name: "destructured array pattern with short names",
			options: [{ minLength: 3 }]
		},
		{
			code: `const { x = 5 } = obj;`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "assignment pattern in destructuring with short name",
			options: [{ minLength: 3 }]
		},
		{
			code: `const { ...r } = obj;`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "rest element in object pattern with short name",
			options: [{ minLength: 3 }]
		},
		{
			code: `const func = (x) => x`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "arrow function parameter too short",
			options: [{ minLength: 3 }]
		},
		{
			code: `const func = function(x) { return x; }`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "function expression parameter too short",
			options: [{ minLength: 3 }]
		},
		{
			code: `try {} catch (e) {}`,
			errors: [{ messageId: "variableNameTooShort" }],
			name: "catch clause with short name and minLength 3",
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
		},
		{
			code: `const { name, value } = obj;`,
			name: "destructured object pattern with long enough names",
			options: [{ minLength: 3 }]
		},
		{
			code: `const [foo, bar] = arr;`,
			name: "destructured array pattern with long enough names",
			options: [{ minLength: 3 }]
		},
		{
			code: `const { name = 5 } = obj;`,
			name: "assignment pattern in destructuring with long enough name",
			options: [{ minLength: 3 }]
		},
		{
			code: `function process(items: number[]) { return items.map(i => i); }`,
			name: "outer corresponding identifier allows short arrow param",
			options: [{ minLength: 3 }]
		}
	]
});

console.log("min-var-length: All tests passed!");
