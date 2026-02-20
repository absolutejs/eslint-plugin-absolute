import { RuleTester } from "@typescript-eslint/rule-tester";
import { sortKeysFixable } from "../src/rules/sort-keys-fixable";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("sort-keys-fixable", sortKeysFixable, {
	valid: [
		{
			name: "already sorted, no comments",
			code: `const obj = { a: 1, b: 2, c: 3 };`
		},
		{
			name: "already sorted with comments",
			code: `const obj = {
	// comment about a
	a: 1,
	// comment about b
	b: 2,
	c: 3
};`
		}
	],
	invalid: [
		{
			name: "basic unsorted, single line",
			code: `const obj = { b: 1, a: 2 };`,
			errors: [{ messageId: "unsorted" }],
			output: `const obj = { a: 2, b: 1 };`
		},
		{
			name: "unsorted multiline, no comments",
			code: `const obj = {
	b: 1,
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			output: `const obj = {
	a: 2,
	b: 1
};`
		},
		{
			name: "unsorted with leading comment",
			code: `const obj = {
	b: 1,
	// comment about a
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			output: `const obj = {
	// comment about a
	a: 2,
	b: 1
};`
		},
		{
			name: "unsorted with inline block comment",
			code: `const obj = {
	c: 3, /* comment about c */
	a: 1,
	b: 2
};`,
			errors: [{ messageId: "unsorted" }],
			output: `const obj = {
	a: 1,
	b: 2,
	c: 3, /* comment about c */
};`
		},
		{
			name: "unsorted with leading comments on every property",
			code: `const obj = {
	// comment about c
	c: 3,
	// comment about a
	a: 1,
	// comment about b
	b: 2
};`,
			errors: [{ messageId: "unsorted" }],
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
			name: "unsorted with trailing comment",
			code: `const obj = {
	b: 1, // trailing comment
	a: 2
};`,
			errors: [{ messageId: "unsorted" }],
			output: `const obj = {
	a: 2,
	b: 1, // trailing comment
};`
		}
	]
});

console.log("sort-keys-fixable: All tests passed!");
