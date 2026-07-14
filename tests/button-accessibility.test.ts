import { describe, expect, test } from "bun:test";
import { scanButtonAccessibility } from "../src/utils/buttonAccessibility";

const invalidByFramework: Record<string, string> = {
	angular: `<button (click)="send()"><span class="material-icons">send</span></button>`,
	ember: `<template><button type="button" {{on "click" this.send}}><span class="material-icons">send</span></button></template>`,
	html: `<button type="button"><span class="material-icons">send</span></button>`,
	htmx: `<button hx-post="/send"><span class="material-icons">send</span></button>`,
	react: `<button onClick={send}><span className="material-icons">send</span></button>`,
	svelte: `<button on:click={send}><span class="material-icons">send</span></button>`,
	vue: `<button @click="send"><span class="material-icons">send</span></button>`
};

const validByFramework: Record<string, string> = {
	angular: `<button [attr.aria-label]="sendLabel"><span class="material-icons" [attr.aria-hidden]="true">send</span></button>`,
	ember: `<template><button aria-label={{this.sendLabel}}><span class="material-icons" aria-hidden="true">send</span></button></template>`,
	html: `<button aria-label="Send message"><span class="material-icons" aria-hidden="true">send</span></button>`,
	htmx: `<button hx-post="/send" aria-label="Send message"><span class="material-icons" aria-hidden="true">send</span></button>`,
	react: `<button aria-label="Send message"><span className="material-icons" aria-hidden={true}>send</span></button>`,
	svelte: `<button aria-label={sendLabel}><span class="material-icons" aria-hidden={true}>send</span></button>`,
	vue: `<button :aria-label="sendLabel"><span class="material-icons" :aria-hidden="true">send</span></button>`
};

describe("cross-framework button accessibility scanner", () => {
	for (const [framework, source] of Object.entries(invalidByFramework)) {
		test(`${framework}: rejects a raw icon name as the button label`, () => {
			const [finding] = scanButtonAccessibility(source);

			expect(finding?.missingAccessibleName).toBe(true);
			expect(finding?.exposedIcons).toHaveLength(1);
		});
	}

	for (const [framework, source] of Object.entries(validByFramework)) {
		test(`${framework}: accepts an explicit name and hidden icon`, () => {
			const [finding] = scanButtonAccessibility(source);

			expect(finding?.missingAccessibleName).toBe(false);
			expect(finding?.exposedIcons).toHaveLength(0);
		});
	}

	test("visible button text is already an accessible name", () => {
		const [finding] = scanButtonAccessibility(
			`<button><span class="material-icons" aria-hidden="true">save</span> Save</button>`
		);

		expect(finding?.missingAccessibleName).toBe(false);
	});

	test("title alone does not replace a programmatic accessible name", () => {
		const [finding] = scanButtonAccessibility(
			`<button title="Send message"><span class="material-icons">send</span></button>`
		);

		expect(finding?.missingAccessibleName).toBe(true);
	});
});
