import { RuleTester } from "@typescript-eslint/rule-tester";
import vueParser from "vue-eslint-parser";
import { dialogHasFocusRestoration } from "../src/rules/dialog-has-focus-restoration";

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

ruleTester.run("dialog-has-focus-restoration", dialogHasFocusRestoration, {
	invalid: [
		{
			code: `<template><div v-if="open" role="dialog"></div></template>`,
			errors: [
				{ messageId: "missingRef" },
				{ messageId: "missingBeforeUnmount" }
			],
			filename: "Panel.vue",
			name: "a conditional ARIA dialog needs the complete restoration surface"
		},
		{
			code: `<template><dialog v-if="open" ref="dialog"></dialog></template>`,
			errors: [{ messageId: "missingBeforeUnmount" }],
			filename: "NativeDialog.vue",
			name: "a conditional native dialog needs a restoration hook"
		},
		{
			code: `<template><div role="dialog"></div></template>`,
			errors: [
				{ messageId: "missingRef" },
				{ messageId: "missingBeforeUnmount" }
			],
			filename: "ChildDialog.vue",
			name: "a dialog can be removed when its component is unmounted by a parent"
		}
	],
	valid: [
		{
			code: `<template><div v-if="open" ref="dialog" role="dialog" @vue:before-unmount="restoreFocus"></div></template>`,
			filename: "ManagedDialog.vue",
			name: "a conditional dialog with a restoration lifecycle is accepted"
		},
		{
			code: `<template><div ref="dialog" role="dialog" @vue:before-unmount="restoreFocus"></div></template>`,
			filename: "ChildManagedDialog.vue",
			name: "a component-owned dialog with a restoration lifecycle is accepted"
		},
		{
			code: `<template><section v-if="open"></section></template>`,
			filename: "ConditionalSection.vue",
			name: "a conditional non-dialog is outside the rule"
		}
	]
});
