/**
 * @fileoverview Disallow grouping CSS style objects in a single export.
 * Instead of exporting an object that contains multiple CSS style objects,
 * export each style separately.
 */

export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow grouping CSS style objects in a single export; export each style separately.",
			category: "Best Practices",
			recommended: false
		},
		schema: [] // no options
	},
	create(context) {
		/**
		 * Checks if the given ObjectExpression node contains multiple properties
		 * that look like CSS style objects (i.e. property keys ending with "Style").
		 */
		function checkObjectExpression(node) {
			if (node.properties && node.properties.length > 0) {
				const cssStyleProperties = node.properties.filter((prop) => {
					if (prop.key) {
						if (prop.key.type === "Identifier") {
							return prop.key.name.endsWith("Style");
						}
						if (
							prop.key.type === "Literal" &&
							typeof prop.key.value === "string"
						) {
							return prop.key.value.endsWith("Style");
						}
					}
					return false;
				});
				if (cssStyleProperties.length > 1) {
					context.report({
						node,
						message:
							"Do not group CSS style objects in a single export; export each style separately."
					});
				}
			}
		}

		return {
			// Check default exports that are object literals.
			ExportDefaultDeclaration(node) {
				if (
					node.declaration &&
					node.declaration.type === "ObjectExpression"
				) {
					checkObjectExpression(node.declaration);
				}
			},
			// Optionally, also check for object literals returned from exported functions.
			ReturnStatement(node) {
				if (
					node.argument &&
					node.argument.type === "ObjectExpression"
				) {
					checkObjectExpression(node.argument);
				}
			}
		};
	}
};
