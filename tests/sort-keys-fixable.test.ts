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
			code: `const obj = { "b": 1, "a": 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "string literal keys unsorted",
			output: `const obj = { "a": 2, "b": 1 };`
		},
		{
			code: `const obj = { c: 3, a: 1, b: 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "order: desc, mixed order is fixed to descending",
			options: [{ order: "desc" }],
			output: `const obj = { c: 3, b: 2, a: 1 };`
		},
		{
			code: `const obj = { B: 1, a: 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "caseSensitive: false (default), case-insensitive comparison",
			output: `const obj = { a: 2, B: 1 };`
		},
		{
			code: `const obj = { a10: 1, a2: 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "natural: true, numeric sorting (a2 before a10)",
			options: [{ natural: true }],
			output: `const obj = { a2: 2, a10: 1 };`
		},
		{
			code: `const obj = { c: 3, b: 2, a: 1 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "minKeys: 3, object with 3 keys is checked",
			options: [{ minKeys: 3 }],
			output: `const obj = { a: 1, b: 2, c: 3 };`
		},
		{
			code: `const obj = { onClick: () => {}, b: 2, a: 1 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "variablesBeforeFunctions: true, function before variables",
			options: [{ variablesBeforeFunctions: true }],
			output: `const obj = { a: 1, b: 2, onClick: () => {} };`
		},
		{
			code: `const obj = { [computed]: 1, b: 2, a: 3 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "computed key disables autofix"
		},
		{
			code: `const obj = { ...rest, b: 1, a: 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "spread element disables autofix"
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
		},
		{
			code: `const obj = { "a": 1, "b": 2 };`,
			name: "string literal keys already sorted"
		},
		{
			code: `const obj = { a: 1, b: 2, c: 3 };`,
			name: "order: desc, no unsorted adjacent pairs detected",
			options: [{ order: "desc" }]
		},
		{
			code: `const obj = { a: 1, B: 2 };`,
			name: "caseSensitive: false (default), case-insensitive a before B"
		},
		{
			code: `const obj = { a2: 1, a10: 2 };`,
			name: "natural: true, numeric order (a2 before a10)",
			options: [{ natural: true }]
		},
		{
			code: `const obj = { b: 1, a: 2 };`,
			name: "minKeys: 3, object with 2 keys is not checked",
			options: [{ minKeys: 3 }]
		},
		{
			code: `const obj = { a: 1, b: 2, onClick: () => {} };`,
			name: "variablesBeforeFunctions: true, variables before functions already sorted",
			options: [{ variablesBeforeFunctions: true }]
		}
	]
});

const jsxRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

jsxRuleTester.run("sort-keys-fixable (JSX)", sortKeysFixable, {
	invalid: [
		{
			code: `const C = () => <Comp z="1" a="2" />;`,
			errors: [{ messageId: "unsorted" }],
			name: "JSX attributes unsorted",
			output: `const C = () => <Comp a="2" z="1" />;`
		},
		{
			code: `const C = () => <Comp style={{ b: 1, a: 2 }} />;`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "JSX attribute with unsorted object value",
			output: `const C = () => <Comp style={{ a: 2, b: 1 }} />;`
		}
	],
	valid: [
		{
			code: `const C = () => <Comp a="1" z="2" />;`,
			name: "JSX attributes already sorted"
		},
		{
			code: `const C = () => <Comp style={{ a: 1, b: 2 }} />;`,
			name: "JSX attribute with sorted object value"
		}
	]
});

console.log("sort-keys-fixable: All tests passed!");
