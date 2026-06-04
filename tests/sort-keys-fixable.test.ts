import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
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
			name: "spread segments the object; the post-spread segment sorts (literals)",
			output: `const obj = { ...rest, a: 2, b: 1 };`
		},
		{
			code: `const obj = { b: 1, a: 2, ...rest };`,
			errors: [{ messageId: "unsorted" }],
			name: "trailing spread: the pre-spread segment sorts",
			output: `const obj = { a: 2, b: 1, ...rest };`
		},
		{
			code: `const obj = { d: 4, c: 3, ...rest, b: 2, a: 1 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "mid spread: both segments sort independently, spread stays put",
			output: `const obj = { c: 3, d: 4, ...rest, a: 1, b: 2 };`
		},
		{
			code: `const obj = { z: 1, y: 2, ...a, ...b, q: 3, p: 4 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "multiple spreads: each segment sorts, spreads never cross",
			output: `const obj = { y: 2, z: 1, ...a, ...b, p: 4, q: 3 };`
		},
		{
			code: `const obj = { ...base, flush: () => 1, append: () => 2 };`,
			errors: [{ messageId: "unsorted" }],
			name: "post-spread segment with function-literal values sorts (pure to construct)",
			output: `const obj = { ...base, append: () => 2, flush: () => 1 };`
		},
		{
			code: `const obj = { ...rest, b: 1, a: foo() };`,
			errors: [{ messageId: "unsorted" }],
			name: "segment with a single impure value still sorts",
			output: `const obj = { ...rest, a: foo(), b: 1 };`
		},
		{
			code: `const obj = { ...rest, b: foo(), a: bar() };`,
			errors: [{ messageId: "unsorted" }],
			name: "segment with two impure values reports but is NOT fixed"
		},
		{
			code: `const obj = { ...rest, [x]: 1, b: 2, a: 3 };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "computed key still disables the fix globally, even across a spread"
		},
		{
			code: `const obj = { ...rest, b: 1, a: 2, b: 3 };`,
			errors: [{ messageId: "unsorted" }],
			name: "duplicate key still disables the fix globally, even across a spread"
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
			code: `const fn = (state) => ({
	z: 1,
	first: state.first.trim(),
	second: state.second.toUpperCase(),
	third: state.third.padEnd(5, "x")
});`,
			errors: [{ messageId: "unsorted" }],
			name: "expanded PURE_MEMBER_METHODS: string non-mutating chain (0.5.0 #2)",
			output: `const fn = (state) => ({
	first: state.first.trim(),
	second: state.second.toUpperCase(),
	third: state.third.padEnd(5, "x"),
	z: 1
});`
		},
		{
			code: `const fn = (data) => ({
	zeta: 1,
	floor: Math.floor(data.x),
	abs: Math.abs(data.y),
	max: Math.max(data.a, data.b)
});`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "expanded PURE_MEMBER_METHODS: Math static methods (0.5.0 #2)",
			output: `const fn = (data) => ({
	abs: Math.abs(data.y),
	floor: Math.floor(data.x),
	max: Math.max(data.a, data.b),
	zeta: 1
});`
		},
		{
			code: `const fn = (obj) => ({
	zeta: 1,
	keys: Object.keys(obj),
	entries: Object.entries(obj),
	values: Object.values(obj)
});`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "expanded PURE_MEMBER_METHODS: Object static methods (0.5.0 #2)",
			output: `const fn = (obj) => ({
	entries: Object.entries(obj),
	keys: Object.keys(obj),
	values: Object.values(obj),
	zeta: 1
});`
		},
		{
			code: `const arr = [1, 2, 3];
const fn = (other) => ({
	zeta: arr.push(other),
	alpha: arr.push(0)
});`,
			errors: [{ messageId: "unsorted" }],
			name: "mutating array methods (push) still disable autofix"
		},
		{
			code: `const SIZES = [1, 2, 3];
const fn = (extras) => ({
	zeta: 1,
	alpha: [...SIZES],
	beta: [...SIZES, 4]
});`,
			errors: [{ messageId: "unsorted" }],
			name: "spread of stable identifier in array literal is pure (0.5.0 #3)",
			output: `const SIZES = [1, 2, 3];
const fn = (extras) => ({
	alpha: [...SIZES],
	beta: [...SIZES, 4],
	zeta: 1
});`
		},
		{
			code: `const fn = (data) => ({
	zeta: 1,
	alpha: [...(data.a || [])],
	beta: [...(data.b || [])]
});`,
			errors: [{ messageId: "unsorted" }],
			name: "spread of pure logical expression in array literal is pure (0.5.0 #3)",
			output: `const fn = (data) => ({
	alpha: [...(data.a || [])],
	beta: [...(data.b || [])],
	zeta: 1
});`
		},
		{
			code: `const fn = (input) => {
	let firstName = input.firstName;
	let lastName = input.lastName;
	const email = "x";
	if (!firstName) firstName = "x";
	if (!lastName) lastName = "x";

	return { z: 1, firstName, lastName, email };
};`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "let-bound shorthand reads are pure (Fix #1)",
			output: `const fn = (input) => {
	let firstName = input.firstName;
	let lastName = input.lastName;
	const email = "x";
	if (!firstName) firstName = "x";
	if (!lastName) lastName = "x";

	return { email, firstName, lastName, z: 1 };
};`
		},
		{
			code: `var counterA = 0;
var counterB = 0;
const obj = { z: 1, counterA, counterB };`,
			errors: [{ messageId: "unsorted" }],
			name: "var-bound shorthand reads are pure (Fix #1)",
			output: `var counterA = 0;
var counterB = 0;
const obj = { counterA, counterB, z: 1 };`
		},
		{
			code: `let counter = 0;
const obj = { b: counter = 5, a: counter = 6 };`,
			errors: [{ messageId: "unsorted" }],
			name: "two assignment-expression values still disable autofix (Fix #1 doesn't make writes pure)"
		},
		{
			code: `const fn = () => {
	const handlers = {
		get total() {
			return 1;
		},
		get rows() {
			return 2;
		},
		set rows(value) {
			void value;
		},
		get pageSize() {
			return 3;
		}
	};

	return handlers;
};`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "getter/setter accessor pair sorts together as a unit (Fix #2)",
			output: `const fn = () => {
	const handlers = {
		get pageSize() {
			return 3;
		},
		get rows() {
			return 2;
		},
		set rows(value) {
			void value;
		},
		get total() {
			return 1;
		}
	};

	return handlers;
};`
		},
		{
			code: `const fn = () => {
	const obj = {
		set name(value) {
			void value;
		},
		get name() {
			return "x";
		},
		age: 1
	};

	return obj;
};`,
			errors: [{ messageId: "unsorted" }],
			name: "set-then-get pair preserves their relative order after sort (Fix #2)",
			output: `const fn = () => {
	const obj = {
		age: 1,
		set name(value) {
			void value;
		},
		get name() {
			return "x";
		}
	};

	return obj;
};`
		},
		{
			code: `const obj = { b: 1, a: 2, b: 3 };`,
			errors: [{ messageId: "unsorted" }],
			name: "real init/init duplicate keys still disable autofix (Fix #2 only relaxes accessor pairs)"
		},
		{
			code: `const obj = {
	get name() {
		return 1;
	},
	get name() {
		return 2;
	},
	age: 1
};`,
			errors: [{ messageId: "unsorted" }],
			name: "duplicate getters (no setter) still disable autofix"
		},
		{
			code: `const obj = {
	get name() {
		return 1;
	},
	name: "x",
	age: 1
};`,
			errors: [{ messageId: "unsorted" }],
			name: "init alongside accessor with same key still disables autofix"
		},
		{
			code: `class Cls {
	log() {
		return {
			profileId: this.profileId,
			searchRunId: this.searchRunId,
			trigger: this.trigger,
			source: 1,
			operation: 2
		};
	}
}
new Cls();`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "this.<name> reads in a method are pure for reordering (Fix #3)",
			output: `class Cls {
	log() {
		return {
			operation: 2,
			profileId: this.profileId,
			searchRunId: this.searchRunId,
			source: 1,
			trigger: this.trigger
		};
	}
}
new Cls();`
		},
		{
			code: `export const Aaa = 1;
export const Bbb = 2;
export const Ccc = 3;

export const exports = {
	Ccc,
	Aaa,
	Bbb
};`,
			errors: [{ messageId: "unsorted" }],
			name: "exported top-level consts are visible to the cascade check (0.6.0)",
			output: `export const Aaa = 1;
export const Bbb = 2;
export const Ccc = 3;

export const exports = {
	Aaa,
	Bbb,
	Ccc
};`
		},
		{
			code: `const fn = () => {
	const handlers = new Map();
	const ws = new WeakSet([{}]);

	return { z: handlers, a: ws };
};`,
			errors: [{ messageId: "unsorted" }],
			name: "new <UserClass>(pureArgs) is encapsulated-fresh (0.6.0)",
			output: `const fn = () => {
	const handlers = new Map();
	const ws = new WeakSet([{}]);

	return { a: ws, z: handlers };
};`
		},
		{
			code: `const fn = (entries) => {
	const map = new Map();
	for (const [key, group] of entries) {
		map.set(key, { value: group, key });
	}

	return { z: 1, m: map };
};`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "for-of bindings are stable inside the loop body (0.6.0)",
			output: `const fn = (entries) => {
	const map = new Map();
	for (const [key, group] of entries) {
		map.set(key, { key, value: group });
	}

	return { m: map, z: 1 };
};`
		},
		{
			code: `const trim = (str) => {
	if (!str) return "";
	let out = str;
	out = out.toLowerCase();

	return out;
};

const fn = (input) => ({ z: 1, a: trim(input.a), b: trim(input.b) });`,
			errors: [{ messageId: "unsorted" }],
			name: "module helper with if + let + assignment is recognized pure (0.6.0)",
			output: `const trim = (str) => {
	if (!str) return "";
	let out = str;
	out = out.toLowerCase();

	return out;
};

const fn = (input) => ({ a: trim(input.a), b: trim(input.b), z: 1 });`
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
			code: `const obj = { z: 1, ...rest, a: 2 };`,
			name: "keys on opposite sides of a spread are not compared (can't be reordered)"
		},
		{
			code: `const obj = { a: 1, b: 2, ...rest, c: 3, d: 4 };`,
			name: "each spread-delimited segment already sorted"
		},
		{
			code: `const obj = { ...a, b: 1, ...c, d: 2 };`,
			name: "single-key segments between spreads have nothing to sort"
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

const tsRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

tsRuleTester.run("sort-keys-fixable (TypeScript wrappers)", sortKeysFixable, {
	invalid: [
		{
			code: `const obj = { b: 1, a: "received" as const };`,
			errors: [{ messageId: "unsorted" }],
			name: "as const value is treated as pure (Fix #4)",
			output: `const obj = { a: "received" as const, b: 1 };`
		},
		{
			code: `const fn = (x: string | null) => ({
	zeta: 1,
	alpha: x!,
	beta: 2
});`,
			errors: [{ messageId: "unsorted" }],
			name: "non-null assertion (x!) is treated as pure (Fix #4)",
			output: `const fn = (x: string | null) => ({
	alpha: x!,
	beta: 2,
	zeta: 1
});`
		},
		{
			code: `const fn = (x: unknown) => ({
	zeta: 1,
	alpha: x as string,
	beta: 2
});`,
			errors: [{ messageId: "unsorted" }],
			name: "as expression value is treated as pure (Fix #4)",
			output: `const fn = (x: unknown) => ({
	alpha: x as string,
	beta: 2,
	zeta: 1
});`
		},
		{
			code: `type Foo = { foo: number };
const fn = () => ({
	zeta: 1,
	alpha: { foo: 1 } satisfies Foo,
	beta: 2
});`,
			errors: [{ messageId: "unsorted" }],
			name: "satisfies expression is treated as pure (Fix #4)",
			output: `type Foo = { foo: number };
const fn = () => ({
	alpha: { foo: 1 } satisfies Foo,
	beta: 2,
	zeta: 1
});`
		},
		{
			code: `import { sideEffect } from "./x";
const obj = { c: sideEffect("c"), b: 1, a: "x" as const };`,
			errors: [{ messageId: "unsorted" }, { messageId: "unsorted" }],
			name: "as const composes with single-impure relaxation (only sideEffect counts as impure)",
			output: `import { sideEffect } from "./x";
const obj = { a: "x" as const, b: 1, c: sideEffect("c") };`
		}
	],
	valid: [
		{
			code: `const obj = { a: "x" as const, b: 1 };`,
			name: "already-sorted with as const"
		}
	]
});

console.log("sort-keys-fixable: All tests passed!");
