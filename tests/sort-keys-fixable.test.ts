import { RuleTester } from "@typescript-eslint/rule-tester";
import { sortKeysFixable } from "../src/rules/sort-keys-fixable";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("sort-keys-fixable", sortKeysFixable, {
	invalid: [
		{
			code: `const obj = { b: 1, a: 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "basic unsorted, single line",
			output: `const obj = { a: 2, b: 1 };`
		},
		{
			code: `const obj = {
	b: 1,
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			name: "unsorted multiline, no comments",
			output: `const obj = {
	a: 2,
	b: 1
};`
		},
		{
			code: `const obj = {
	b: 1,
	// comment about a
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			name: "unsorted with leading comment",
			output: `const obj = {
	// comment about a
	a: 2,
	b: 1
};`
		},
		{
			code: `const obj = {
	c: 3, /* comment about c */
	a: 1,
	b: 2
};`,
			errors: [{ messageId: "unsorted" }],
			name: "unsorted with inline block comment",
			output: `const obj = {
	a: 1,
	b: 2,
	c: 3, /* comment about c */
};`
		},
		{
			code: `const obj = {
	// comment about c
	c: 3,
	// comment about a
	a: 1,
	// comment about b
	b: 2
};`,
			errors: [{ messageId: "unsorted" }],
			name: "unsorted with leading comments on every property",
			output: `const obj = {
	// comment about a
	a: 1,
	// comment about b
	b: 2,
	// comment about c
	c: 3
};`
		},
		{
			code: `const obj = {
	b: 1, // trailing comment
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			name: "unsorted with trailing comment",
			output: `const obj = {
	a: 2,
	b: 1, // trailing comment
};`
		}
	],
	valid: [
		{
			code: `const obj = { a: 1, b: 2, c: 3 };`,
			name: "already sorted, no comments"
		},
		{
			code: `const obj = {
	// comment about a
	a: 1,
	// comment about b
	b: 2,
	c: 3
};`,
			name: "already sorted with comments"
		}
	]
});

console.log("sort-keys-fixable: All tests passed!");
