import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { noNondeterministicRender } from "../src/rules/no-nondeterministic-render";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-nondeterministic-render", noNondeterministicRender, {
	invalid: [
		{
			code: `
@Component({
	template: '<p>{{ Math.random() }}</p>'
})
export class Dashboard {}
`,
			errors: [{ messageId: "nondeterministicTemplate" }],
			name: "Math.random in Angular template"
		},
		{
			code: `
@Component({
	template: '<p>safe</p>'
})
export class Dashboard {
	readonly id = crypto.randomUUID();
}
`,
			errors: [{ messageId: "nondeterministicField" }],
			name: "crypto.randomUUID in Angular component field"
		},
		{
			code: `
@Component({
	template: '<p>safe</p>'
})
export class Dashboard {
	readonly createdAt = new Date();
}
`,
			errors: [{ messageId: "nondeterministicField" }],
			name: "new Date without arguments in Angular component field"
		},
		{
			code: `
@Component({
	template: '<p>safe</p>'
})
export class Dashboard {
	readonly timestamp = Date.now();
}
`,
			errors: [{ messageId: "nondeterministicField" }],
			name: "Date.now in Angular component field"
		},
		{
			code: `
@Component({
	template: '<p>safe</p>'
})
export class Dashboard {
	readonly elapsed = performance.now();
}
`,
			errors: [{ messageId: "nondeterministicField" }],
			name: "performance.now in Angular component field"
		}
	],
	valid: [
		{
			code: `
@Component({
	template: '<button (click)="shuffle()">Shuffle</button>'
})
export class Dashboard {
	shuffle() {
		return Math.random();
	}
}
`,
			name: "Math.random inside event-triggered method"
		},
		{
			code: `
@Component({
	template: '<p>{{ value }}</p>'
})
export class Dashboard {
	readonly value = this.random();
	private readonly random = inject(DETERMINISTIC_RANDOM);
}
`,
			name: "injected deterministic random field"
		},
		{
			code: `
@Component({
	template: '<p>safe</p>'
})
export class Dashboard {
	readonly createdAt = new Date('2026-04-29T12:00:00.000Z');
}
`,
			name: "new Date with explicit argument"
		},
		{
			code: `
export class PlainClass {
	readonly value = Math.random();
}
`,
			name: "non-Angular class field"
		},
		{
			code: `
@Component({
	templateUrl: './dashboard.html'
})
export class Dashboard {}
`,
			name: "external template"
		}
	]
});

console.log("no-nondeterministic-render: All tests passed!");
