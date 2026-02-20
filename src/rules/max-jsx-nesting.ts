import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [number];
type MessageIds = "tooDeeplyNested";

export const maxJSXNesting: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const option = context.options[0];
		const maxAllowed = typeof option === "number" ? option : 1;

		/**
		 * Calculates the JSX nesting level for the given node by traversing the node.parent chain.
		 * The level is computed by counting the current node (level 1) plus each ancestor
		 * that is a JSXElement or JSXFragment.
		 * @param {ASTNode} node The JSX element node.
		 * @returns {number} The nesting level.
		 */
		function getJSXNestingLevel(node: TSESTree.Node): number {
			let level = 1; // count the current node as level 1
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				if (
					current.type === "JSXElement" ||
					current.type === "JSXFragment"
				) {
					level++;
				}
				current = current.parent;
			}
			return level;
		}

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
