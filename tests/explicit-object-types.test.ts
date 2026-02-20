import { RuleTester } from "@typescript-eslint/rule-tester";
import { explicitObjectTypes } from "../src/rules/explicit-object-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("explicit-object-types", explicitObjectTypes, {
	invalid: [
		{
			code: `const obj = { a: 1 };`,
			errors: [{ messageId: "objectLiteralNeedsType" }],
			name: "object literal without type annotation"
		},
		{
			code: `const arr = [{ a: 1 }, { b: 2 }];`,
			errors: [{ messageId: "arrayOfObjectLiteralsNeedsType" }],
			name: "array of object literals without type annotation"
		},
		{
			code: `const arr = [...other, { a: 1 }];`,
			errors: [{ messageId: "arrayOfObjectLiteralsNeedsType" }],
			name: "array with spread and object literal without type annotation"
		},
		{
			code: `const obj = { nested: { a: 1 } };`,
			errors: [{ messageId: "objectLiteralNeedsType" }],
			name: "nested objects only flags outer object literal"
		}
	],
	valid: [
		{
			code: `type Foo = { a: number }; const obj: Foo = { a: 1 };`,
			name: "object literal with type annotation"
		},
		{
			code: `const x = 42;`,
			name: "non-object initializer"
		},
		{
			code: `const arr = [1, 2, 3];`,
			name: "array of primitives"
		},
		{
			code: `type Item = { a: number }; const arr: Item[] = [{ a: 1 }];`,
			name: "array of objects with type annotation"
		},
		{
			code: `const { a } = { a: 1 };`,
			name: "destructured variable with object init is not flagged"
		},
		{
			code: `let obj;`,
			name: "variable with no initializer is not flagged"
		}
	]
});

console.log("explicit-object-types: All tests passed!");
