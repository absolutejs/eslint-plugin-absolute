import { RuleTester } from "@typescript-eslint/rule-tester";
import vueParser from "vue-eslint-parser";
import { modalHasFocusManagement } from "../src/rules/modal-has-focus-management";

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

ruleTester.run("modal-has-focus-management", modalHasFocusManagement, {
	invalid: [
		{
			code: `<template><div role="dialog" aria-modal="true"></div></template>`,
			errors: [
				{ messageId: "missingRef" },
				{ messageId: "missingTabindex" },
				{ messageId: "missingKeydown" }
			],
			filename: "ProductTour.vue",
			name: "an ARIA modal needs the complete focus-management surface"
		},
		{
			code: `<template><section :aria-modal="isModal" ref="panel" tabindex="-1"></section></template>`,
			errors: [{ messageId: "missingKeydown" }],
			filename: "Panel.vue",
			name: "a bound modal state is covered"
		}
	],
	valid: [
		{
			code: `<template><div role="dialog" aria-modal="true" ref="dialog" tabindex="-1" @keydown="trapFocus"></div></template>`,
			filename: "ManagedModal.vue",
			name: "a fully managed ARIA modal is accepted"
		},
		{
			code: `<template><div role="dialog" aria-modal="false"></div></template>`,
			filename: "NonModalDialog.vue",
			name: "an explicitly non-modal dialog does not need containment"
		},
		{
			code: `<template><div role="dialog"></div></template>`,
			filename: "Dialog.vue",
			name: "a non-modal dialog is outside this rule"
		},
		{
			code: `<template><section :aria-modal="modal" :ref="setModal" :tabindex="-1" @keydown.tab="trapFocus"></section></template>`,
			filename: "BoundModal.vue",
			name: "bound hooks and a modified keydown handler are accepted"
		}
	]
});
