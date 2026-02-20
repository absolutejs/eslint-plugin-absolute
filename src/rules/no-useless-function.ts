import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "uselessFunction";

export const noUselessFunction: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		function isCallbackFunction(node: TSESTree.ArrowFunctionExpression) {
			const { parent } = node;
			if (!parent || parent.type !== "CallExpression") {
				return false;
			}

			for (const arg of parent.arguments) {
				if (arg === node) {
					return true;
				}
			}

			return false;
		}

		return {
			ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
				// Check for functions with no parameters and a body that's an ObjectExpression
				if (
					node.params.length === 0 &&
					node.body &&
					node.body.type === "ObjectExpression"
				) {
					// If the function is used as a callback (like in react-spring), skip reporting.
					if (isCallbackFunction(node)) {
						return;
					}
					context.report({
						messageId: "uselessFunction",
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
				"Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring)."
		},
		messages: {
			uselessFunction:
				"This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function."
		},
		schema: [],
		type: "suggestion"
	}
};
