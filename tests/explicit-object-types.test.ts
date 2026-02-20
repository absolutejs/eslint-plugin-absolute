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
		}
	]
});

console.log("explicit-object-types: All tests passed!");
