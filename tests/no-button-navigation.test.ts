import { RuleTester } from "@typescript-eslint/rule-tester";
import { noButtonNavigation } from "../src/rules/no-button-navigation";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
		parserOptions: { ecmaFeatures: { jsx: true } }
	}
});

ruleTester.run("no-button-navigation", noButtonNavigation, {
	valid: [
		{
			name: "button onClick without navigation",
			code: `const C = () => <button onClick={() => { console.log("click"); }}>Click</button>;`
		},
		{
			name: "anchor tag with href",
			code: `const C = () => <a href="/page">Go</a>;`
		},
		{
			name: "non-button element with onClick doing navigation",
			code: `const C = () => <div onClick={() => { window.location = "/foo"; }}>Go</div>;`
		},
		{
			name: "button onClick with replaceState reading window.location.pathname",
			code: `const C = () => <button onClick={() => { const p = window.location.pathname; window.history.replaceState({}, "", p + "?q=1"); }}>Update</button>;`
		}
	],
	invalid: [
		{
			name: "button onClick assigning window.location",
			code: `const C = () => <button onClick={() => { window.location = "/new-page"; }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }]
		},
		{
			name: "button onClick calling window.location.replace",
			code: `const C = () => <button onClick={() => { window.location.replace("/new"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }]
		},
		{
			name: "button onClick calling window.open",
			code: `const C = () => <button onClick={() => { window.open("/new"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }]
		},
		{
			name: "button onClick with replaceState but no location read",
			code: `const C = () => <button onClick={() => { window.history.replaceState({}, "", "/new-path"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }]
		}
	]
});

console.log("no-button-navigation: All tests passed!");
