import { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * @fileoverview Disallow grouping CSS style objects in a single export.
 * Instead of exporting an object that contains multiple CSS style objects,
 * export each style separately.
 */

type Options = [];
type MessageIds = "noMultiStyleObjects";

const getPropertyName = (prop: TSESTree.Property) => {
	const { key } = prop;
	if (key.type === "Identifier") {
		return key.name;
	}
	if (key.type === "Literal" && typeof key.value === "string") {
		return key.value;
	}
	return null;
};

export const noMultiStyleObjects: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		/**
		 * Checks if the given ObjectExpression node contains multiple properties
		 * that look like CSS style objects (i.e. property keys ending with "Style").
		 */
		const checkObjectExpression = (node: TSESTree.ObjectExpression) => {
			if (!node.properties.length) {
				return;
			}

			const cssStyleProperties = node.properties.filter((prop) => {
				if (prop.type !== "Property") {
					return false;
				}
				const name = getPropertyName(prop);
				return name !== null && name.endsWith("Style");
			});

			if (cssStyleProperties.length > 1) {
				context.report({
					messageId: "noMultiStyleObjects",
					node
				});
			}
		};

		return {
			// Check default exports that are object literals.
			ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
				const { declaration } = node;
				if (declaration && declaration.type === "ObjectExpression") {
					checkObjectExpression(declaration);
				}
			},
			// Optionally, also check for object literals returned from exported functions.
			ReturnStatement(node: TSESTree.ReturnStatement) {
				const { argument } = node;
				if (argument && argument.type === "ObjectExpression") {
					checkObjectExpression(argument);
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow grouping CSS style objects in a single export; export each style separately."
		},
		messages: {
			noMultiStyleObjects:
				"Do not group CSS style objects in a single export; export each style separately."
		},
		schema: [], // no options,
		type: "problem"
	}
};
