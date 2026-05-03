import { RuleTester } from "@typescript-eslint/rule-tester";
import { angularOneFeaturePerFile } from "../src/rules/angular-one-feature-per-file";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		sourceType: "module"
	}
});

ruleTester.run("angular-one-feature-per-file", angularOneFeaturePerFile, {
	invalid: [
		{
			code: `
				@Component({ selector: "app-foo", template: "" })
				class FooComponent {}

				@Component({ selector: "app-bar", template: "" })
				class BarComponent {}
			`,
			errors: [{ messageId: "multiFeature" }],
			name: "two components flag the second"
		},
		{
			code: `
				@Component({ selector: "app-foo", template: "" })
				class FooComponent {}

				@Injectable({ providedIn: "root" })
				class FooService {}
			`,
			errors: [{ messageId: "multiFeature" }],
			name: "component plus service flags the service"
		},
		{
			code: `
				@Pipe({ name: "fooPipe" })
				class FooPipe {}

				@Directive({ selector: "[appFoo]" })
				class FooDirective {}
			`,
			errors: [{ messageId: "multiFeature" }],
			name: "pipe plus directive flags the directive"
		},
		{
			code: `
				@NgModule({ declarations: [], imports: [] })
				class AppModule {}

				@Component({ selector: "app-root", template: "" })
				class AppComponent {}
			`,
			errors: [{ messageId: "multiFeature" }],
			name: "module plus component flags the component"
		},
		{
			code: `
				@Component({ selector: "app-foo", template: "" })
				class FooComponent {}

				@Component({ selector: "app-bar", template: "" })
				class BarComponent {}

				@Component({ selector: "app-baz", template: "" })
				class BazComponent {}
			`,
			errors: [
				{ messageId: "multiFeature" },
				{ messageId: "multiFeature" }
			],
			name: "three features flag the second and third"
		},
		{
			code: `
				@Injectable({ providedIn: "root" })
				class AService {}

				@Injectable({ providedIn: "root" })
				class BService {}
			`,
			errors: [{ messageId: "multiFeature" }],
			name: "two services flag the second"
		}
	],
	valid: [
		{
			code: `
				@Component({ selector: "app-foo", template: "" })
				class FooComponent {}
			`,
			name: "single component"
		},
		{
			code: `
				@Injectable({ providedIn: "root" })
				class FooService {}
			`,
			name: "single service"
		},
		{
			code: `
				@Pipe({ name: "fooPipe" })
				class FooPipe {}
			`,
			name: "single pipe"
		},
		{
			code: `
				@Component({
					selector: "app-foo",
					template: ""
				})
				class FooComponent {
					@Input() value = "";
					@Output() change = new EventEmitter<string>();
					@HostListener("click") onClick() {}
				}
			`,
			name: "member decorators (@Input, @Output, @HostListener) are not features"
		},
		{
			code: `
				class FooHelper {}
				class BarHelper {}
				class BazHelper {}
			`,
			name: "plain classes without decorators are ignored"
		},
		{
			code: `
				@Component({ selector: "app-foo", template: "" })
				class FooComponent {}

				class FooHelper {}
				class FooData {}
			`,
			name: "one feature plus undecorated helper classes is fine"
		},
		{
			code: ``,
			name: "empty file"
		}
	]
});

console.log("angular-one-feature-per-file: All tests passed!");
