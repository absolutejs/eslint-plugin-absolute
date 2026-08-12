import { RuleTester } from "@typescript-eslint/rule-tester";
import vueParser from "vue-eslint-parser";
import { progressbarHasState } from "../src/rules/progressbar-has-state";

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

ruleTester.run("progressbar-has-state", progressbarHasState, {
	invalid: [
		{
			code: `<template><div role="progressbar" aria-label="Progress"></div></template>`,
			errors: [{ messageId: "missingState" }],
			filename: "Meter.vue",
			name: "bare progressbar has ambiguous runtime semantics"
		}
	],
	valid: [
		{
			code: `<template><div role="progressbar" :aria-valuenow="completed" aria-valuemin="0" :aria-valuemax="total"></div></template>`,
			filename: "Checklist.vue",
			name: "determinate progressbar exposes its current value"
		},
		{
			code: `<template><span role="progressbar" aria-busy="true" aria-label="Loading"></span></template>`,
			filename: "Spinner.vue",
			name: "indeterminate progressbar explicitly exposes loading state"
		},
		{
			code: `<template><span role="progressbar" data-beacon-loading="sync" aria-label="Syncing"></span></template>`,
			filename: "Sync.vue",
			name: "Beacon loading contract marks an indeterminate progressbar"
		},
		{
			code: `<template><div role="meter" aria-valuenow="2"></div></template>`,
			filename: "Meter.vue",
			name: "other range roles are outside this rule"
		}
	]
});
