import { describe, expect, test } from "bun:test";
import { type ESLint, Linter } from "eslint";
import plugin from "../src";

// The plugin uses @typescript-eslint's compatible rule types; ESLint 10's types are stricter.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const eslintPlugin = plugin as unknown as ESLint.Plugin;

const accessibilityRules = {
	"absolute/button-icon-is-hidden": "error",
	"absolute/icon-button-has-accessible-name": "error"
} as const;

const verifyTemplate = (filename: string, source: string) => {
	const linter = new Linter({ configType: "flat" });
	return linter.verify(
		source,
		[
			{
				files: ["**/*.js"],
				plugins: { absolute: eslintPlugin },
				rules: accessibilityRules
			},
			{
				files: ["**/*.{html,vue,svelte,gjs,gts}"],
				plugins: { absolute: eslintPlugin },
				processor: "absolute/template-source"
			}
		],
		{ filename }
	);
};

describe("template-source processor", () => {
	for (const extension of ["html", "vue", "svelte", "gjs", "gts"]) {
		test(`${extension}: applies both rules and preserves source lines`, () => {
			const messages = verifyTemplate(
				`src/component.${extension}`,
				`<section>\n\t<button title="Send">\n\t\t<span class="material-icons">send</span>\n\t</button>\n</section>`
			);

			expect(
				messages.map(({ line, ruleId }) => ({ line, ruleId }))
			).toEqual([
				{
					line: 2,
					ruleId: "absolute/icon-button-has-accessible-name"
				},
				{
					line: 3,
					ruleId: "absolute/button-icon-is-hidden"
				}
			]);
		});
	}

	test("accepts an explicitly named button with a hidden icon", () => {
		const messages = verifyTemplate(
			"src/component.gts",
			`<template>\n\t<button aria-label="Send">\n\t\t<span class="material-icons" aria-hidden="true">send</span>\n\t</button>\n</template>`
		);

		expect(messages).toEqual([]);
	});
});
