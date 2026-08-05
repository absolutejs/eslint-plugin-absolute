import { RuleTester } from "@typescript-eslint/rule-tester";
import vueParser from "vue-eslint-parser";
import { loadingIndicatorHasAriaBusy } from "../src/rules/loading-indicator-has-aria-busy";

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

ruleTester.run("loading-indicator-has-aria-busy", loadingIndicatorHasAriaBusy, {
	invalid: [
		{
			code: `<template><span class="loading-ring"></span></template>`,
			errors: [{ messageId: "missingAriaBusy" }],
			filename: "Network.vue",
			name: "bare spinner needs aria-busy",
			output: `<template><span class="loading-ring" aria-busy="true"></span></template>`
		},
		{
			code: `<template><div class="card sync-spinner"></div></template>`,
			errors: [{ messageId: "missingAriaBusy" }],
			filename: "Sync.vue",
			name: "spinner token inside a class list is detected",
			output: `<template><div class="card sync-spinner" aria-busy="true"></div></template>`
		},
		{
			code: `<template><div class="row skeleton"></div></template>`,
			errors: [{ messageId: "missingAriaBusy" }],
			filename: "Skeleton.vue",
			name: "skeleton placeholders are loading indicators too",
			output: `<template><div class="row skeleton" aria-busy="true"></div></template>`
		},
		{
			code: `<template><button :class="{ loading: isSaving }">Save</button></template>`,
			errors: [{ messageId: "missingAriaBusy" }],
			filename: "Save.vue",
			name: "conditional loading class binds aria-busy to the same condition",
			output: `<template><button :class="{ loading: isSaving }" :aria-busy="isSaving">Save</button></template>`
		},
		{
			code: `<template>\n  <span\n    class="loader"\n    data-size="large"\n  ></span>\n</template>`,
			errors: [{ messageId: "missingAriaBusy" }],
			filename: "Multiline.vue",
			name: "multiline fix stays beside the class attribute",
			output: `<template>\n  <span\n    class="loader"\n    aria-busy="true"\n    data-size="large"\n  ></span>\n</template>`
		}
	],
	valid: [
		{
			code: `<template><span class="loading-ring" aria-busy="true"></span></template>`,
			filename: "Marked.vue",
			name: "aria-busy on the indicator satisfies the rule"
		},
		{
			code: `<template><div aria-busy="true"><span class="loading-ring"></span></div></template>`,
			filename: "Region.vue",
			name: "a busy ancestor region satisfies the rule"
		},
		{
			code: `<template><div class="upload-progress spinner" role="progressbar"></div></template>`,
			filename: "Progress.vue",
			name: "an explicit progressbar role satisfies the rule"
		},
		{
			code: `<template><span class="loading-ring" :aria-busy="stillLoading"></span></template>`,
			filename: "Bound.vue",
			name: "a bound aria-busy satisfies the rule"
		},
		{
			code: `<template><button class="load-more">Show more</button></template>`,
			filename: "LoadMore.vue",
			name: "load-more is not a loading indicator"
		},
		{
			code: `<template><div class="downloading-hint"></div></template>`,
			filename: "Hint.vue",
			name: "tokens are matched whole, not as substrings"
		}
	]
});
