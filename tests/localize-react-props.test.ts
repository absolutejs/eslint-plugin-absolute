import { RuleTester } from "@typescript-eslint/rule-tester";
import { localizeReactProps } from "../src/rules/localize-react-props";
import parser from "typescript-eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		parser: parser.parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module"
	}
});

ruleTester.run("localize-react-props", localizeReactProps, {
	invalid: [
		{
			code: `
function Parent() {
	const [count, setCount] = useState(0);
	return <Counter count={count} setCount={setCount} />;
}
`,
			errors: [
				{
					data: {
						setterVarName: "setCount",
						stateVarName: "count"
					},
					messageId: "stateAndSetterToChild"
				}
			],
			name: "useState with both state and setter passed to same single child"
		},
		{
			code: `
function Parent() {
	const title = "Hello";
	return (
		<div>
			<Header title={title} />
		</div>
	);
}
`,
			errors: [
				{
					data: { varName: "title" },
					messageId: "variableToChild"
				}
			],
			name: "single variable only passed to one custom child component"
		}
	],
	valid: [
		{
			code: `
function Parent() {
	const label = "hello";
	return (
		<div>
			<ChildA text={label} />
			<ChildB text={label} />
		</div>
	);
}
`,
			name: "variable used in multiple child components"
		},
		{
			code: `
function Parent() {
	const count = 5;
	console.log(count);
	return <Child value={count} />;
}
`,
			name: "variable used outside JSX (in logic)"
		},
		{
			code: `
function Parent() {
	const cls = "main";
	return <div className={cls} />;
}
`,
			name: "variable passed to a native HTML element"
		},
		{
			code: `
function Parent() {
	const [open, setOpen] = useState(false);
	if (open) console.log("open");
	return <Modal open={open} onClose={setOpen} />;
}
`,
			name: "useState where state is also used outside JSX"
		},
		{
			code: `
function Parent() {
	const theme = "dark";
	return (
		<ThemeProvider value={theme}>
			<Child />
		</ThemeProvider>
	);
}
`,
			name: "variable passed to context provider value prop is ignored"
		},
		{
			code: `
function Parent() {
	const data = useFetch("/api");
	const items = data.items;
	return <Child items={items} />;
}
`,
			name: "variable derived from a non-useState hook result is ignored"
		},
		{
			code: `
function Parent() {
	const firstName = "John";
	const lastName = "Doe";
	return <Profile firstName={firstName} lastName={lastName} />;
}
`,
			name: "two candidate variables passed to the same child are not reported"
		},
		{
			code: `
function Parent() {
	const [value, setValue] = useState("");
	const handleChange = () => setValue("new");
	return <Child value={value} />;
}
`,
			name: "useState where only state is passed but setter is used in parent"
		}
	]
});

console.log("localize-react-props: All tests passed!");
