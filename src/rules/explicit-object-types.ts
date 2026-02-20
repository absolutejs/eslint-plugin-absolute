import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "objectLiteralNeedsType" | "arrayOfObjectLiteralsNeedsType";

export const explicitObjectTypes: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		/**
		 * Returns true if the node is an object literal.
		 * @param {ASTNode} node The AST node to check.
		 */
		const isObjectLiteral = (
			node: TSESTree.Node | null | undefined
		): node is TSESTree.ObjectExpression =>
			node !== null &&
			node !== undefined &&
			node.type === "ObjectExpression";

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				// Skip if there's no initializer.
				if (!node.init) return;

				// Skip if the variable already has a type annotation.
				if (node.id.type === "Identifier" && node.id.typeAnnotation)
					return;

				// Check if the initializer is an object literal.
				if (
					isObjectLiteral(node.init) &&
					node.id.type === "Identifier"
				) {
					context.report({
						messageId: "objectLiteralNeedsType",
						node: node.id
					});
					return;
				}

				// Check if the initializer is an array literal containing any object literals.
				if (node.init.type !== "ArrayExpression") {
					return;
				}

				const hasObjectLiteral = node.init.elements.some((element) => {
					if (!element || element.type === "SpreadElement")
						return false;
					return isObjectLiteral(element);
				});

				if (hasObjectLiteral && node.id.type === "Identifier") {
					context.report({
						messageId: "arrayOfObjectLiteralsNeedsType",
						node: node.id
					});
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require explicit type annotations for object literals and arrays of object literals"
		},
		messages: {
			arrayOfObjectLiteralsNeedsType:
				"Array of object literals must have an explicit type annotation.",
			objectLiteralNeedsType:
				"Object literal must have an explicit type annotation."
		},
		schema: [],
		type: "problem"
	}
};
