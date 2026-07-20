import { RuleTester } from "@typescript-eslint/rule-tester";
import parser from "typescript-eslint";
import { edenRequiresReactQuery } from "../src/rules/eden-requires-react-query";

const ruleTester = new RuleTester({
	languageOptions: { parser: parser.parser }
});

ruleTester.run("eden-requires-react-query", edenRequiresReactQuery, {
	invalid: [
		{
			code: `const save = async () => client.api.projects.post({ name: "Site" });`,
			errors: [{ messageId: "outsideReactQuery" }],
			name: "rejects a direct Eden request"
		},
		{
			code: `import { useEffect } from "react";
const Screen = () => {
	useEffect(() => { void client.api.projects.get(); }, []);
	return null;
};`,
			errors: [{ messageId: "outsideReactQuery" }],
			name: "rejects backend state fetched from an effect"
		},
		{
			code: `const useMutation = (value) => value;
const Screen = () => useMutation({ mutationFn: () => client.api.projects.post() });`,
			errors: [{ messageId: "outsideReactQuery" }],
			name: "does not trust a hook-shaped local function"
		}
	],
	valid: [
		{
			code: `import { useQuery } from "@tanstack/react-query";
const Screen = () => useQuery({ queryFn: async () => client.api.projects.get(), queryKey: ["projects"] });`,
			name: "allows an inline query function"
		},
		{
			code: `import { useMutation as useCommand } from "@tanstack/react-query";
const send = async () => client.api.projects.post({ name: "Site" });
const request = async () => send();
const Screen = () => useCommand({ mutationFn: request });`,
			name: "follows aliased imports and referenced helper calls"
		},
		{
			code: `import { useMutation } from "@tanstack/react-query";
const Screen = () => {
	const action = useMutation({ mutationFn: (input) => input.request() });
	return <button onClick={() => action.mutate({ request: () => client.api.projects.post() })} />;
};`,
			filename: "screen.tsx",
			name: "allows a request closure executed by mutation variables"
		},
		{
			code: `import { useQuery } from "@tanstack/react-query";
const Screen = ({ ids }) => useQuery({
	queryFn: () => Promise.all(ids.map((id) => client.api.projects({ id }).get())),
	queryKey: ["projects", ids]
});`,
			name: "follows nested callbacks inside a query function"
		},
		{
			code: `type Result = ReturnType<typeof client.api.projects.get>;`,
			name: "ignores Eden type queries"
		}
	]
});

console.log("eden-requires-react-query: All tests passed!");
