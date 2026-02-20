import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "noExplicitReturnType";

type AnyFunctionNode =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

export const noExplicitReturnTypes: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const hasSingleObjectReturn = (body: TSESTree.BlockStatement) => {
			const returnStatements = body.body.filter(
				(stmt) => stmt.type === "ReturnStatement"
			);

			if (returnStatements.length !== 1) {
				return false;
			}

			const [returnStmt] = returnStatements;
			return returnStmt?.argument?.type === "ObjectExpression";
		};

		return {
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node: AnyFunctionNode
			) {
				const { returnType } = node;
				if (!returnType) {
					return;
				}

				// Allow type predicate annotations for type guards.
				const { typeAnnotation } = returnType;
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
				if (
					node.body &&
					node.body.type === "BlockStatement" &&
					hasSingleObjectReturn(node.body)
				) {
					return;
				}

				// Otherwise, report an error.
				context.report({
					messageId: "noExplicitReturnType",
					node: returnType
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects)."
		},
		messages: {
			noExplicitReturnType:
				"Explicit return types are disallowed; rely on TypeScript's inference instead."
		},
		schema: [],
		type: "suggestion"
	}
};
