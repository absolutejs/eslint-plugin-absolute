import { RuleTester } from "@typescript-eslint/rule-tester";
import vueParser from "vue-eslint-parser";
import { activeButtonHasAriaState } from "../src/rules/active-button-has-aria-state";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: vueParser,
		parserOptions: {
			extraFileExtensions: [".vue"],
			sourceType: "module"
		},
		sourceType: "module"
	}
});

ruleTester.run("active-button-has-aria-state", activeButtonHasAriaState, {
	invalid: [
		{
			code: `<template><button :class="{ active: selected === option }">All</button></template>`,
			errors: [{ messageId: "missingAriaState" }],
			filename: "Filters.vue",
			name: "active filter button needs pressed state",
			output: `<template><button :class="{ active: selected === option }" :aria-pressed="selected === option">All</button></template>`
		},
		{
			code: `<template><button role="tab" :class="{ selected: tab === option }">Overview</button></template>`,
			errors: [{ messageId: "missingAriaState" }],
			filename: "Tabs.vue",
			name: "tab button needs selected state",
			output: `<template><button role="tab" :class="{ selected: tab === option }" :aria-selected="tab === option">Overview</button></template>`
		},
		{
			code: `<template><button :class="{ 'is-active': enabled }" :aria-pressed="other">Toggle</button></template>`,
			errors: [{ messageId: "missingAriaState" }],
			filename: "Toggle.vue",
			name: "aria state must use the visual state condition",
			output: null
		}
	],
	valid: [
		{
			code: `<template><button :class="{ active: selected === option }" :aria-pressed="selected === option">All</button></template>`,
			filename: "Filters.vue",
			name: "pressed state matches active condition"
		},
		{
			code: `<template><button role="tab" :class="{ selected: tab === option }" :aria-selected="tab === option">Overview</button></template>`,
			filename: "Tabs.vue",
			name: "selected state matches tab condition"
		},
		{
			code: `<template><button class="active">Always styled</button></template>`,
			filename: "Static.vue",
			name: "static class is outside the conditional-state rule"
		},
		{
			code: `<template><button :class="{ loading: busy }">Save</button></template>`,
			filename: "Save.vue",
			name: "non-state class is ignored"
		},
		{
			code: `<template><div :class="{ active: selected }">Panel</div></template>`,
			filename: "Panel.vue",
			name: "non-button elements are ignored"
		}
	]
});

console.log("active-button-has-aria-state: All tests passed!");
