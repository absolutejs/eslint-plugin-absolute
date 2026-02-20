import { RuleTester } from "@typescript-eslint/rule-tester";
import { noMultiStyleObjects } from "../src/rules/no-multi-style-objects";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("no-multi-style-objects", noMultiStyleObjects, {
	invalid: [
		{
			code: `export default { headerStyle: {}, footerStyle: {} };`,
			errors: [{ messageId: "noMultiStyleObjects" }],
			name: "export default with multiple style properties"
		},
		{
			code: `function getStyles() { return { headerStyle: {}, footerStyle: {} }; }`,
			errors: [{ messageId: "noMultiStyleObjects" }],
			name: "return with multiple style properties"
		}
	],
	valid: [
		{
			code: `export default { headerStyle: { color: "red" } };`,
			name: "export default with one style property"
		},
		{
			code: `export default { foo: 1, bar: 2 };`,
			name: "export default with no style properties"
		},
		{
			code: `function getStyles() { return { containerStyle: {} }; }`,
			name: "return with one style property"
		}
	]
});

console.log("no-multi-style-objects: All tests passed!");
