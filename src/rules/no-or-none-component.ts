import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "useLogicalAnd";

export const noOrNoneComponent: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer using logical && operator over ternary with null/undefined for conditional JSX rendering."
		},
		schema: [],
		messages: {
			useLogicalAnd:
				"Prefer using the logical '&&' operator instead of a ternary with null/undefined for conditional rendering."
		}
	},

	defaultOptions: [],

	create(context) {
		return {
			ConditionalExpression(node: TSESTree.ConditionalExpression) {
				const alternate = node.alternate;

				// Check if alternate is explicitly null or undefined
				const isNullAlternate =
					alternate &&
					alternate.type === "Literal" &&
					alternate.value === null;

				const isUndefinedAlternate =
					alternate &&
					alternate.type === "Identifier" &&
					alternate.name === "undefined";

				if (!isNullAlternate && !isUndefinedAlternate) {
					return;
				}

				// Check if the node is within a JSX expression container.
				const parent = node.parent;
				if (!parent || parent.type !== "JSXExpressionContainer") {
					return;
				}

				const containerParent = parent.parent;
				// Only flag if the JSXExpressionContainer is used as a child,
				// not as a prop (i.e. not within a JSXAttribute)
				if (
					containerParent &&
					containerParent.type !== "JSXAttribute"
				) {
					context.report({
						node,
						messageId: "useLogicalAnd"
					});
				}
			}
		};
	}
};

// TODO : Add a fix function to this rule, it needs a deep unconflicting fix becasue of react/jsx-no-leaked-render, it needs to explicitly be === something like that
