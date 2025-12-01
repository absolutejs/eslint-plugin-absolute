import { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * @fileoverview Disallow grouping CSS style objects in a single export.
 * Instead of exporting an object that contains multiple CSS style objects,
 * export each style separately.
 */

type Options = [];
type MessageIds = "noMultiStyleObjects";

export const noMultiStyleObjects: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow grouping CSS style objects in a single export; export each style separately."
		},
		schema: [], // no options
		messages: {
			noMultiStyleObjects:
				"Do not group CSS style objects in a single export; export each style separately."
		}
	},

	defaultOptions: [],

	create(context) {
		/**
		 * Checks if the given ObjectExpression node contains multiple properties
		 * that look like CSS style objects (i.e. property keys ending with "Style").
		 */
		function checkObjectExpression(node: TSESTree.ObjectExpression) {
			if (!node.properties.length) {
				return;
			}

			const cssStyleProperties: TSESTree.Property[] = [];

			for (const prop of node.properties) {
				if (prop.type !== "Property") {
					continue;
				}

				const key = prop.key;
				let name: string | null = null;

				if (key.type === "Identifier") {
					name = key.name;
				} else if (
					key.type === "Literal" &&
					typeof key.value === "string"
				) {
					name = key.value;
				}

				if (name && name.endsWith("Style")) {
					cssStyleProperties.push(prop);
				}
			}

			if (cssStyleProperties.length > 1) {
				context.report({
					node,
					messageId: "noMultiStyleObjects"
				});
			}
		}

		return {
			// Check default exports that are object literals.
			ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
				const declaration = node.declaration;
				if (declaration && declaration.type === "ObjectExpression") {
					checkObjectExpression(declaration);
				}
			},
			// Optionally, also check for object literals returned from exported functions.
			ReturnStatement(node: TSESTree.ReturnStatement) {
				const argument = node.argument;
				if (argument && argument.type === "ObjectExpression") {
					checkObjectExpression(argument);
				}
			}
		};
	}
};
