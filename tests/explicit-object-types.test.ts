import { RuleTester } from "@typescript-eslint/rule-tester";
import { explicitObjectTypes } from "../src/rules/explicit-object-types";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parser: parser.parser
	}
});

ruleTester.run("explicit-object-types", explicitObjectTypes, {
	valid: [
		{
			name: "object literal with type annotation",
			code: `type Foo = { a: number }; const obj: Foo = { a: 1 };`
		},
		{
			name: "non-object initializer",
			code: `const x = 42;`
		},
		{
			name: "array of primitives",
			code: `const arr = [1, 2, 3];`
		},
		{
			name: "array of objects with type annotation",
			code: `type Item = { a: number }; const arr: Item[] = [{ a: 1 }];`
		}
	],
	invalid: [
		{
			name: "object literal without type annotation",
			code: `const obj = { a: 1 };`,
			errors: [{ messageId: "objectLiteralNeedsType" }]
		},
		{
			name: "array of object literals without type annotation",
			code: `const arr = [{ a: 1 }, { b: 2 }];`,
			errors: [{ messageId: "arrayOfObjectLiteralsNeedsType" }]
		}
	]
});

console.log("explicit-object-types: All tests passed!");
