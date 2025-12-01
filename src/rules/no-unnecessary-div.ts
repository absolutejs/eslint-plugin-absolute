import { TSESLint, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "unnecessaryDivWrapper";

export const noUnnecessaryDiv: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed."
		},
		schema: [],
		messages: {
			unnecessaryDivWrapper:
				"Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose."
		}
	},

	defaultOptions: [],

	create(context) {
		function isDivElement(node: TSESTree.JSXElement) {
			const nameNode = node.openingElement.name;
			return (
				nameNode.type === AST_NODE_TYPES.JSXIdentifier &&
				nameNode.name === "div"
			);
		}

		function getMeaningfulChildren(
			node: TSESTree.JSXElement
		): TSESTree.JSXChild[] {
			const result: TSESTree.JSXChild[] = [];
			for (const child of node.children) {
				if (child.type === AST_NODE_TYPES.JSXText) {
					if (child.value.trim() !== "") {
						result.push(child);
					}
				} else {
					result.push(child);
				}
			}
			return result;
		}

		return {
			JSXElement(node: TSESTree.JSXElement) {
				if (!isDivElement(node)) {
					return;
				}

				const meaningfulChildren = getMeaningfulChildren(node);

				if (meaningfulChildren.length !== 1) {
					return;
				}

				const onlyChild = meaningfulChildren[0];
				if (!onlyChild) {
					return;
				}

				if (onlyChild.type === AST_NODE_TYPES.JSXElement) {
					context.report({
						node,
						messageId: "unnecessaryDivWrapper"
					});
				}
			}
		};
	}
};
