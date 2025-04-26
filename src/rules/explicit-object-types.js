export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Require explicit type annotations for object literals and arrays of object literals",
			recommended: false
		},
		schema: []
	},
	create(context) {
		/**
		 * Returns true if the node is an object literal.
		 * @param {ASTNode} node The AST node to check.
		 */
		function isObjectLiteral(node) {
			return node && node.type === "ObjectExpression";
		}

		return {
			VariableDeclarator(node) {
				// Skip if there's no initializer.
				if (!node.init) return;

				// Skip if the variable already has a type annotation.
				if (node.id && node.id.typeAnnotation) return;

				// Check if the initializer is an object literal.
				if (isObjectLiteral(node.init)) {
					context.report({
						node: node.id,
						message:
							"Object literal must have an explicit type annotation."
					});
					return;
				}

				// Check if the initializer is an array literal containing any object literals.
				if (node.init.type === "ArrayExpression") {
					const hasObjectLiteral = node.init.elements.some(
						(element) => element && isObjectLiteral(element)
					);
					if (hasObjectLiteral) {
						context.report({
							node: node.id,
							message:
								"Array of object literals must have an explicit type annotation."
						});
					}
				}
			}
		};
	}
};
