import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "objectLiteralNeedsType" | "arrayOfObjectLiteralsNeedsType";

export const explicitObjectTypes: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Require explicit type annotations for object literals and arrays of object literals"
		},
		schema: [],
		messages: {
			objectLiteralNeedsType:
				"Object literal must have an explicit type annotation.",
			arrayOfObjectLiteralsNeedsType:
				"Array of object literals must have an explicit type annotation."
		}
	},
	defaultOptions: [],
	create(context) {
		/**
		 * Returns true if the node is an object literal.
		 * @param {ASTNode} node The AST node to check.
		 */
		function isObjectLiteral(
			node: TSESTree.Node | null | undefined
		): node is TSESTree.ObjectExpression {
			return !!node && node.type === "ObjectExpression";
		}

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				// Skip if there's no initializer.
				if (!node.init) return;

				// Skip if the variable already has a type annotation.
				if (node.id.type === "Identifier" && node.id.typeAnnotation)
					return;

				// Check if the initializer is an object literal.
				if (isObjectLiteral(node.init)) {
					if (node.id.type === "Identifier") {
						context.report({
							node: node.id,
							messageId: "objectLiteralNeedsType"
						});
					}
					return;
				}

				// Check if the initializer is an array literal containing any object literals.
				if (node.init.type === "ArrayExpression") {
					const hasObjectLiteral = node.init.elements.some(
						(element) => {
							if (!element || element.type === "SpreadElement")
								return false;
							return isObjectLiteral(element);
						}
					);

					if (hasObjectLiteral && node.id.type === "Identifier") {
						context.report({
							node: node.id,
							messageId: "arrayOfObjectLiteralsNeedsType"
						});
					}
				}
			}
		};
	}
};
