import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "uselessCatch";

const unwrapExpression = (
	expression: TSESTree.Expression
): TSESTree.Expression => {
	switch (expression.type) {
		case "ChainExpression":
			return unwrapExpression(expression.expression);
		case "TSAsExpression":
		case "TSNonNullExpression":
		case "TSSatisfiesExpression":
		case "TSTypeAssertion":
			return unwrapExpression(expression.expression);
		default:
			return expression;
	}
};

const hasSideEffect = (expression: TSESTree.Expression): boolean => {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case "AssignmentExpression":
		case "AwaitExpression":
		case "CallExpression":
		case "ImportExpression":
		case "NewExpression":
		case "UpdateExpression":
		case "YieldExpression":
			return true;
		case "UnaryExpression":
			return unwrapped.operator === "delete";
		case "ConditionalExpression":
			return (
				hasSideEffect(unwrapped.consequent) ||
				hasSideEffect(unwrapped.alternate)
			);
		case "LogicalExpression":
			return (
				hasSideEffect(unwrapped.left) || hasSideEffect(unwrapped.right)
			);
		case "SequenceExpression":
			return unwrapped.expressions.some(hasSideEffect);
		default:
			return false;
	}
};

const statementDoesWork = (statement: TSESTree.Statement) => {
	if (statement.type === "EmptyStatement") {
		return false;
	}

	if (statement.type === "ExpressionStatement") {
		return hasSideEffect(statement.expression);
	}

	return true;
};

export const noUselessCatch = createRule<Options, MessageIds>({
	create(context) {
		return {
			CatchClause(node: TSESTree.CatchClause) {
				if (node.body.body.some(statementDoesWork)) {
					return;
				}

				context.report({
					messageId: "uselessCatch",
					node: node.body
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow catch blocks that contain only comments or no-op statements. A catch block should handle, propagate, or record the error."
		},
		messages: {
			uselessCatch:
				"This catch block does not do any work. Handle, log, return, or rethrow the error instead of leaving a comment or no-op."
		},
		schema: [],
		type: "problem"
	},
	name: "no-useless-catch"
});
