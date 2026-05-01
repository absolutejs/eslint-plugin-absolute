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
			code: `const obj = { b: 1, a: 2, a: 3 };`,
			errors: [{ messageId: "unsorted" }],
			name: "duplicate keys disable autofix"
		},
		{
			code: `const obj = { b: sideEffect("b"), a: sideEffect("a") };`,
			errors: [{ messageId: "unsorted" }],
			name: "two side-effectful property values disable autofix"
		},
		{
			code: `import { sideEffect } from "./x";
const obj = { b: 1, a: sideEffect("a") };`,
			errors: [{ messageId: "unsorted" }],
			name: "single impure value still autofixes when other values are pure",
			output: `import { sideEffect } from "./x";
const obj = { a: sideEffect("a"), b: 1 };`
		},
		{
			code: `const fn = (theme) => ({ b: 1, a: theme?.value });`,
			errors: [{ messageId: "unsorted" }],
			name: "optional member access on a stable local is treated as pure",
			output: `const fn = (theme) => ({ a: theme?.value, b: 1 });`
		},
		{
			code: `import { asset } from "./absolute";
import { Home } from "./Home";
const fn = (manifest, theme, user) => ({
	Page: Home,
	index: asset(manifest, "HomeIndex"),
	props: { theme: theme?.value, user }
});`,
			errors: [{ messageId: "unsorted" }],
			name: "imported call alongside pure values autofixes (single-impure relaxation + optional chaining)",
			output: `import { asset } from "./absolute";
import { Home } from "./Home";
const fn = (manifest, theme, user) => ({
	index: asset(manifest, "HomeIndex"),
	Page: Home,
	props: { theme: theme?.value, user }
});`
		},
		{
			code: `import { asset, isValidProviderOption } from "./absolute";
const fn = (manifest, query) => ({
	b: asset(manifest, "x"),
	a: isValidProviderOption(query.provider) ? query.provider : "default"
});`,
			errors: [{ messageId: "unsorted" }],
			name: "C1 pureImports allowlist treats listed callees as pure",
			options: [{ pureImports: ["asset", "isValidProviderOption"] }],
			output: `import { asset, isValidProviderOption } from "./absolute";
const fn = (manifest, query) => ({
	a: isValidProviderOption(query.provider) ? query.provider : "default",
	b: asset(manifest, "x")
});`
		},
		{
			code: `import { t } from "elysia";
const obj = { b: t.Object({}), a: t.Optional(t.String()) };`,
			errors: [{ messageId: "unsorted" }],
			name: "C1 pureImports allowlist supports namespace member paths",
			options: [{ pureImports: ["t.Object", "t.Optional", "t.String"] }],
			output: `import { t } from "elysia";
const obj = { a: t.Optional(t.String()), b: t.Object({}) };`
		},
		{
			code: `const formatTimestamp = (date) => {
	const minuteText = String(date.getMinutes()).padStart(2, "0");

	return minuteText;
};
const obj = { resolveOrder: "2nd", resolvedAt: formatTimestamp(new Date()) };`,
			errors: [{ messageId: "unsorted" }],
			name: "pure local helper call enables autofix",
			output: `const formatTimestamp = (date) => {
	const minuteText = String(date.getMinutes()).padStart(2, "0");

	return minuteText;
};
const obj = { resolvedAt: formatTimestamp(new Date()), resolveOrder: "2nd" };`
		},
		{
			code: `const formatTimestamp = (date) => String(date.getMinutes());
const createSlotPromise = async (label, delayMs, resolveOrder) => {
	return {
		delayMs,
		label,
		resolveOrder,
		resolvedAt: formatTimestamp(new Date())
	};
};`,
			errors: [{ messageId: "unsorted" }],
			name: "function params in object values remain autofixable",
			output: `const formatTimestamp = (date) => String(date.getMinutes());
const createSlotPromise = async (label, delayMs, resolveOrder) => {
	return {
		delayMs,
		label,
		resolvedAt: formatTimestamp(new Date()),
		resolveOrder
	};
};`
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
		},
		{
			code: `import { DEFAULT_QUALITY } from './imageClient';
const component = {
	props: {
		src: { required: true, type: String },
		alt: { required: true, type: String },
		width: { default: undefined, type: Number },
		height: { default: undefined, type: Number },
		fill: { default: false, type: Boolean },
		quality: { default: DEFAULT_QUALITY, type: Number },
		sizes: { default: undefined, type: String },
		loader: { default: undefined, type: Function },
		unoptimized: { default: false, type: Boolean },
		loading: { default: 'lazy', type: String },
		priority: { default: false, type: Boolean },
		placeholder: { default: undefined, type: String },
		blurDataURL: { default: undefined, type: String },
		className: { default: undefined, type: String },
		style: { default: undefined, type: Object },
		onLoad: { default: undefined, type: Function },
		onError: { default: undefined, type: Function },
		crossOrigin: { default: undefined, type: String },
		referrerPolicy: { default: undefined, type: String },
		fetchPriority: { default: undefined, type: String },
		overrideSrc: { default: undefined, type: String }
	}
};`,
			errors: [
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" },
				{ messageId: "unsorted" }
			],
			name: "Vue prop constructors and undefined defaults are autofixable",
			options: [{ caseSensitive: true, variablesBeforeFunctions: true }],
			output: `import { DEFAULT_QUALITY } from './imageClient';
const component = {
	props: {
		alt: { required: true, type: String },
		blurDataURL: { default: undefined, type: String },
		className: { default: undefined, type: String },
		crossOrigin: { default: undefined, type: String },
		fetchPriority: { default: undefined, type: String },
		fill: { default: false, type: Boolean },
		height: { default: undefined, type: Number },
		loader: { default: undefined, type: Function },
		loading: { default: 'lazy', type: String },
		onError: { default: undefined, type: Function },
		onLoad: { default: undefined, type: Function },
		overrideSrc: { default: undefined, type: String },
		placeholder: { default: undefined, type: String },
		priority: { default: false, type: Boolean },
		quality: { default: DEFAULT_QUALITY, type: Number },
		referrerPolicy: { default: undefined, type: String },
		sizes: { default: undefined, type: String },
		src: { required: true, type: String },
		style: { default: undefined, type: Object },
		unoptimized: { default: false, type: Boolean },
		width: { default: undefined, type: Number }
	}
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
		},
		{
			code: `const C = () => <Comp z="1" a="2" a="3" />;`,
			errors: [{ messageId: "unsorted" }],
			name: "duplicate JSX attributes disable autofix"
		},
		{
			code: `const C = () => <Comp z={sideEffect("z")} a={sideEffect("a")} />;`,
			errors: [{ messageId: "unsorted" }],
			name: "two side-effectful JSX attribute values disable autofix"
		},
		{
			code: `import { sideEffect } from "./x";
const C = () => <Comp z="1" a={sideEffect("a")} />;`,
			errors: [{ messageId: "unsorted" }],
			name: "single impure JSX attribute still autofixes when other attrs are pure",
			output: `import { sideEffect } from "./x";
const C = () => <Comp a={sideEffect("a")} z="1" />;`
		},
		{
			code: `const createFallback = (label) => \`\${label}\`;
const C = () => <Comp z="1" a={createFallback("ok")} />;`,
			errors: [{ messageId: "unsorted" }],
			name: "pure local helper JSX attribute enables autofix",
			output: `const createFallback = (label) => \`\${label}\`;
const C = () => <Comp a={createFallback("ok")} z="1" />;`
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
