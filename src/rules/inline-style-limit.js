export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow inline style objects with too many keys and encourage extracting them",
			category: "Best Practices",
			recommended: false
		},
		schema: [
			{
				anyOf: [
					{
						type: "number"
					},
					{
						type: "object",
						properties: {
							maxKeys: {
								type: "number",
								description:
									"Maximum number of keys allowed in an inline style object before it must be extracted."
							}
						},
						additionalProperties: false
					}
				]
			}
		],
		messages: {
			extractStyle:
				"Inline style objects should be extracted into a separate object or file when containing more than {{max}} keys."
		}
	},

	create(context) {
		const option = context.options[0];
		// If a number is passed directly, use it as maxKeys; otherwise, extract maxKeys from the object (default to 3)
		const maxKeys =
			typeof option === "number"
				? option
				: (option && option.maxKeys) || 3;

		return {
			JSXAttribute(node) {
				// Check if the attribute name is 'style'
				if (node.name.name !== "style") {
					return;
				}

				// Ensure the value is a JSX expression container with an object literal
				if (
					node.value &&
					node.value.type === "JSXExpressionContainer" &&
					node.value.expression &&
					node.value.expression.type === "ObjectExpression"
				) {
					const styleObject = node.value.expression;

					// Count only "Property" nodes (ignoring spread elements or others)
					const keyCount = styleObject.properties.filter(
						(prop) => prop.type === "Property"
					).length;

					// Report only if the number of keys exceeds the allowed maximum
					if (keyCount > maxKeys) {
						context.report({
							node,
							messageId: "extractStyle",
							data: { max: maxKeys }
						});
					}
				}
			}
		};
	}
};
