import { TSESLint, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "unnecessaryDivWrapper";

export const noUnnecessaryDiv: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const isDivElement = (node: TSESTree.JSXElement) => {
			const nameNode = node.openingElement.name;
			return (
				nameNode.type === AST_NODE_TYPES.JSXIdentifier &&
				nameNode.name === "div"
			);
		};

		const isMeaningfulChild = (child: TSESTree.JSXChild) => {
			if (child.type === AST_NODE_TYPES.JSXText) {
				return child.value.trim() !== "";
			}
			return true;
		};

		const getMeaningfulChildren = (node: TSESTree.JSXElement) =>
			node.children.filter(isMeaningfulChild);

		return {
			JSXElement(node: TSESTree.JSXElement) {
				if (!isDivElement(node)) {
					return;
				}

				const meaningfulChildren = getMeaningfulChildren(node);

				if (meaningfulChildren.length !== 1) {
					return;
				}

				const [onlyChild] = meaningfulChildren;
				if (!onlyChild) {
					return;
				}

				if (onlyChild.type === AST_NODE_TYPES.JSXElement) {
					context.report({
						messageId: "unnecessaryDivWrapper",
						node
					});
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed."
		},
		messages: {
			unnecessaryDivWrapper:
				"Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose."
		},
		schema: [],
		type: "suggestion"
	}
};
