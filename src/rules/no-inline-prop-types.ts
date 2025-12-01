import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "noInlinePropTypes";

export const noInlinePropTypes: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce that component prop types are not defined inline (using an object literal) but rather use a named type or interface."
		},
		schema: [],
		messages: {
			noInlinePropTypes:
				"Inline prop type definitions are not allowed. Use a named type alias or interface instead of an inline object type."
		}
	},

	defaultOptions: [],

	create(context) {
		/**
		 * Checks the node representing a parameter to determine if it is an ObjectPattern with an inline type literal.
		 * @param {ASTNode} param The parameter node from the function declaration/expression.
		 */
		function checkParameter(param: TSESTree.Parameter) {
			// Ensure we are dealing with a destructured object pattern with a type annotation.
			if (
				param.type === "ObjectPattern" &&
				param.typeAnnotation &&
				param.typeAnnotation.type === "TSTypeAnnotation"
			) {
				// The actual type annotation node (for example, { mode: string } yields a TSTypeLiteral).
				const annotation = param.typeAnnotation.typeAnnotation;
				// If the type is an inline object (TSTypeLiteral), we want to report it.
				if (annotation.type === "TSTypeLiteral") {
					context.report({
						node: param,
						messageId: "noInlinePropTypes"
					});
				}
			}
		}

		return {
			// Applies to FunctionDeclaration, ArrowFunctionExpression, and FunctionExpression nodes.
			"FunctionDeclaration, ArrowFunctionExpression, FunctionExpression"(
				node:
					| TSESTree.FunctionDeclaration
					| TSESTree.ArrowFunctionExpression
					| TSESTree.FunctionExpression
			) {
				// It is common to define props as the first parameter.
				if (node.params.length === 0) {
					return;
				}

				const firstParam = node.params[0];
				if (!firstParam) {
					return;
				}

				checkParameter(firstParam);
			}
		};
	}
};
