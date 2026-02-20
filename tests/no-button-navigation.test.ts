import { RuleTester } from "@typescript-eslint/rule-tester";
import { noButtonNavigation } from "../src/rules/no-button-navigation";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("no-button-navigation", noButtonNavigation, {
	invalid: [
		{
			code: `const C = () => <button onClick={() => { window.location = "/new-page"; }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick assigning window.location"
		},
		{
			code: `const C = () => <button onClick={() => { window.location.replace("/new"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick calling window.location.replace"
		},
		{
			code: `const C = () => <button onClick={() => { window.open("/new"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick calling window.open"
		},
		{
			code: `const C = () => <button onClick={() => { window.history.replaceState({}, "", "/new-path"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick with replaceState but no location read"
		},
		{
			code: `const C = () => <button onClick={function() { window.location = "/new"; }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "FunctionExpression handler assigning window.location"
		},
		{
			code: `const C = () => <button onClick={() => { window.location.href = "/other"; }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick assigning window.location.href"
		},
		{
			code: `const C = () => <button onClick={() => { window.history.pushState({}, "", "/new-path"); }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "button onClick with pushState but no location read"
		},
		{
			code: `const C = () => <button onClick={() => { window.location = "/a"; window.location.href = "/b"; }}>Go</button>;`,
			errors: [{ messageId: "noButtonNavigation" }],
			name: "multiple navigation calls in one handler"
		}
	],
	valid: [
		{
			code: `const C = () => <button onClick={() => { console.log("click"); }}>Click</button>;`,
			name: "button onClick without navigation"
		},
		{
			code: `const C = () => <a href="/page">Go</a>;`,
			name: "anchor tag with href"
		},
		{
			code: `const C = () => <div onClick={() => { window.location = "/foo"; }}>Go</div>;`,
			name: "non-button element with onClick doing navigation"
		},
		{
			code: `const C = () => <button onClick={() => { const p = window.location.pathname; window.history.replaceState({}, "", p + "?q=1"); }}>Update</button>;`,
			name: "button onClick with replaceState reading window.location.pathname"
		}
	]
});

console.log("no-button-navigation: All tests passed!");
