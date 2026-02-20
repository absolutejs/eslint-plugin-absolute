import { TSESLint, TSESTree } from "@typescript-eslint/utils";

const DEFAULT_MAX_KEYS = 3;

type Options = [number | { maxKeys?: number }];
type MessageIds = "extractStyle";

export const inlineStyleLimit: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const [option] = context.options;
		// If a number is passed directly, use it as maxKeys; otherwise, extract maxKeys from the object (default to 3)
		const maxKeys =
			typeof option === "number"
				? option
				: (option && option.maxKeys) || DEFAULT_MAX_KEYS;

		return {
			JSXAttribute(node: TSESTree.JSXAttribute) {
				// Check if the attribute name is 'style'
				if (
					node.name.type !== "JSXIdentifier" ||
					node.name.name !== "style"
				) {
					return;
				}

				// Ensure the value is a JSX expression container with an object literal
				if (
					!node.value ||
					node.value.type !== "JSXExpressionContainer" ||
					!node.value.expression ||
					node.value.expression.type !== "ObjectExpression"
				) {
					return;
				}

				const styleObject = node.value.expression;

				// Count only "Property" nodes (ignoring spread elements or others)
				const keyCount = styleObject.properties.filter(
					(prop): prop is TSESTree.Property =>
						prop.type === "Property"
				).length;

				// Report only if the number of keys exceeds the allowed maximum
				if (keyCount > maxKeys) {
					context.report({
						data: { max: maxKeys },
						messageId: "extractStyle",
						node
					});
				}
			}
		};
	},
	defaultOptions: [DEFAULT_MAX_KEYS],
	meta: {
		docs: {
			description:
				"Disallow inline style objects with too many keys and encourage extracting them"
		},
		messages: {
			extractStyle:
				"Inline style objects should be extracted into a separate object or file when containing more than {{max}} keys."
		},
		schema: [
			{
				anyOf: [
					{
						type: "number"
					},
					{
						additionalProperties: false,
						properties: {
							maxKeys: {
								description:
									"Maximum number of keys allowed in an inline style object before it must be extracted.",
								type: "number"
							}
						},
						type: "object"
					}
				]
			}
		],
		type: "suggestion"
	}
};
