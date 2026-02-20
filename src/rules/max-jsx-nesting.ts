import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [number];
type MessageIds = "tooDeeplyNested";

const isJSXAncestor = (node: TSESTree.Node) =>
	node.type === "JSXElement" || node.type === "JSXFragment";

export const maxJSXNesting: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const [option] = context.options;
		const maxAllowed = typeof option === "number" ? option : 1;

		/**
		 * Calculates the JSX nesting level for the given node by traversing the node.parent chain.
		 */
		const getJSXNestingLevel = (node: TSESTree.Node) => {
			let level = 1; // count the current node as level 1
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				level += isJSXAncestor(current) ? 1 : 0;
				current = current.parent;
			}
			return level;
		};

		return {
			JSXElement(node: TSESTree.JSXElement) {
				const level = getJSXNestingLevel(node);
				if (level > maxAllowed) {
					context.report({
						data: { level, maxAllowed },
						messageId: "tooDeeplyNested",
						node
					});
				}
			}
		};
	},
	defaultOptions: [1],
	meta: {
		docs: {
			description:
				"Warn when JSX elements are nested too deeply, suggesting refactoring into a separate component."
		},
		messages: {
			tooDeeplyNested:
				"JSX element is nested too deeply ({{level}} levels, allowed is {{maxAllowed}} levels). Consider refactoring into a separate component."
		},
		// The rule accepts a single numeric option (minimum 1)
		schema: [
			{
				minimum: 1,
				type: "number"
			}
		],
		type: "suggestion"
	}
};
