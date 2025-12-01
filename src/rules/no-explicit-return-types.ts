import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "noExplicitReturnType";

type AnyFunctionNode =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

export const noExplicitReturnTypes: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects)."
		},
		schema: [],
		messages: {
			noExplicitReturnType:
				"Explicit return types are disallowed; rely on TypeScript's inference instead."
		}
	},

	defaultOptions: [],

	create(context) {
		function hasSingleObjectReturn(body: TSESTree.BlockStatement) {
			let returnCount = 0;
			let returnedObject: TSESTree.ObjectExpression | null = null;

			for (const stmt of body.body) {
				if (stmt.type === "ReturnStatement") {
					returnCount++;
					const arg = stmt.argument;
					if (arg && arg.type === "ObjectExpression") {
						returnedObject = arg;
					}
				}
			}

			return returnCount === 1 && returnedObject !== null;
		}

		return {
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node: AnyFunctionNode
			) {
				const returnType = node.returnType;
				if (!returnType) {
					return;
				}

				// Allow type predicate annotations for type guards.
				const typeAnnotation = returnType.typeAnnotation;
				if (
					typeAnnotation &&
					typeAnnotation.type === "TSTypePredicate"
				) {
					return;
				}

				// Allow if it's an arrow function that directly returns an object literal.
				if (
					node.type === "ArrowFunctionExpression" &&
					node.expression === true &&
					node.body.type === "ObjectExpression"
				) {
					return;
				}

				// Allow if the function has a block body with a single return statement that returns an object literal.
				if (node.body && node.body.type === "BlockStatement") {
					if (hasSingleObjectReturn(node.body)) {
						return;
					}
				}

				// Otherwise, report an error.
				context.report({
					node: returnType,
					messageId: "noExplicitReturnType"
				});
			}
		};
	}
};
