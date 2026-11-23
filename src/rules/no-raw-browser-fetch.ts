import { ASTUtils, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

const fetchReceiver = (callee: TSESTree.CallExpression["callee"]) => {
	if (callee.type === "Identifier")
		return callee.name === "fetch" ? callee : undefined;
	if (
		callee.type !== "MemberExpression" ||
		callee.object.type !== "Identifier" ||
		!["globalThis", "window", "self"].includes(callee.object.name)
	)
		return undefined;
	const { property } = callee;
	const matches = callee.computed
		? property.type === "Literal" && property.value === "fetch"
		: property.type === "Identifier" && property.name === "fetch";
	return matches ? callee.object : undefined;
};

export const noRawBrowserFetch = createRule<[], "rawFetch">({
	create: (context) => ({
		CallExpression(node) {
			const { callee } = node;
			const receiver = fetchReceiver(callee);
			if (!receiver) return;
			const variable = ASTUtils.findVariable(
				context.sourceCode.getScope(receiver),
				receiver.name
			);
			if (variable?.defs.length) return;
			context.report({ messageId: "rawFetch", node: callee });
		}
	}),
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require a typed API client for browser requests in the configured files."
		},
		messages: {
			rawFetch:
				"Use the typed Eden client for browser API requests so the endpoint, request and response are checked together."
		},
		schema: [],
		type: "problem"
	},
	name: "no-raw-browser-fetch"
});
