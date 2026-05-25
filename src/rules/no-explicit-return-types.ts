import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "noExplicitReturnType";

type AnyFunctionNode =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

export const noExplicitReturnTypes = createRule<Options, MessageIds>({
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

		// The binding name a function is reachable by from inside itself:
		// its own id, or the `const x = ...` it is assigned to.
		const getOwnName = (node: AnyFunctionNode) => {
			if (node.id) return node.id.name;
			const { parent } = node;
			if (
				parent.type === "VariableDeclarator" &&
				parent.id.type === "Identifier"
			) {
				return parent.id.name;
			}

			return undefined;
		};

		const getDeclaringNode = (node: AnyFunctionNode) => {
			if (node.id) return node;
			const { parent } = node;
			if (parent.type === "VariableDeclarator") return parent.parent;

			return node;
		};

		// A function that references its own name in its body is recursive.
		// TypeScript cannot infer a return type that depends on the function's
		// own result (TS7023), so the annotation is required — not stylistic.
		const referencesOwnName = (node: AnyFunctionNode) => {
			const ownName = getOwnName(node);
			if (!ownName) return false;

			const variable = context.sourceCode
				.getDeclaredVariables(getDeclaringNode(node))
				.find((candidate) => candidate.name === ownName);
			if (!variable) return false;

			return variable.references.some(
				(reference) =>
					reference.identifier.range[0] >= node.range[0] &&
					reference.identifier.range[1] <= node.range[1]
			);
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

				// Allow recursive (self-referential) functions — TypeScript
				// requires an explicit return type when a function's return
				// depends on its own result (TS7023).
				if (referencesOwnName(node)) {
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
	},
	name: "no-explicit-return-type"
});
