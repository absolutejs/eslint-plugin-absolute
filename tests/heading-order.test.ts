import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "vue-eslint-parser";
import { headingOrder } from "../src/rules/heading-order";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser,
		parserOptions: {
			extraFileExtensions: [".vue"],
			sourceType: "module"
		},
		sourceType: "module"
	}
});

ruleTester.run("heading-order", headingOrder, {
	invalid: [
		{
			code: `<template><section><h3>Generated assets</h3></section></template>`,
			errors: [{ messageId: "firstHeadingTooDeep" }],
			filename: "GeneratedAssets.vue",
			name: "first heading cannot start below h2"
		},
		{
			code: `<template><main><h1>Resources</h1><h3>Shared</h3></main></template>`,
			errors: [{ messageId: "skippedHeadingLevel" }],
			filename: "Resources.vue",
			name: "h1 to h3 jump is rejected"
		},
		{
			code: `<template><section><h2>Resources</h2><h4>Files</h4></section></template>`,
			errors: [{ messageId: "skippedHeadingLevel" }],
			filename: "ResourceSection.vue",
			name: "h2 to h4 jump is rejected"
		},
		{
			code: `<template><h4>Nested widget</h4></template>`,
			errors: [{ messageId: "firstHeadingTooDeep" }],
			filename: "NestedWidget.vue",
			name: "configured first-heading limit is enforced",
			options: [{ maxFirstLevel: 3 }]
		}
	],
	valid: [
		{
			code: `<template><main><h1>Resources</h1><h2>Generated</h2><h3>Recent</h3></main></template>`,
			filename: "Resources.vue",
			name: "sequential heading levels"
		},
		{
			code: `<template><section><h2>Generated</h2><h2>Shared</h2></section></template>`,
			filename: "Resources.vue",
			name: "same-level sibling headings"
		},
		{
			code: `<template><section><h2>Generated</h2><h3>Recent</h3><h2>Shared</h2></section></template>`,
			filename: "Resources.vue",
			name: "heading levels may move upward"
		},
		{
			code: `<template><h3>Nested widget</h3></template>`,
			filename: "NestedWidget.vue",
			name: "components can explicitly allow a deeper first heading",
			options: [{ maxFirstLevel: 3 }]
		},
		{
			code: `const value = 1;`,
			filename: "plain.ts",
			name: "non-Vue files are ignored"
		}
	]
});

console.log("heading-order: All tests passed!");
