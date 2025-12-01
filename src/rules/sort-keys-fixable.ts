import { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * @fileoverview Enforce sorted keys in object literals (like ESLint’s built-in sort-keys)
 * with an auto-fix for simple cases that preserves comments.
 *
 * Note: This rule reports errors just like the original sort-keys rule.
 * However, the auto-fix only applies if all properties are “fixable” – i.e.:
 *  - They are of type Property (not SpreadElement, etc.)
 *  - They are not computed (e.g. [foo])
 *  - They are an Identifier or a Literal.
 *
 * Comments attached to the properties are preserved in the auto-fix.
 *
 * Use this rule with a grain of salt. I did not test every edge case and there’s
 * a reason the original rule doesn’t have auto-fix. Computed keys, spread elements,
 * comments, and formatting are not handled perfectly.
 */

type SortKeysOptions = {
	order?: "asc" | "desc";
	caseSensitive?: boolean;
	natural?: boolean;
	minKeys?: number;
	variablesBeforeFunctions?: boolean;
};

type Options = [SortKeysOptions?];
type MessageIds = "unsorted";

type KeyInfo = {
	keyName: string | null;
	node: TSESTree.Property | TSESTree.SpreadElement;
	isFunction: boolean;
};

export const sortKeysFixable: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)"
		},
		fixable: "code",
		// The schema supports the same options as the built-in sort-keys rule plus:
		//   variablesBeforeFunctions: boolean (when true, non-function properties come before function properties)
		schema: [
			{
				type: "object",
				properties: {
					order: {
						type: "string",
						enum: ["asc", "desc"]
					},
					caseSensitive: {
						type: "boolean"
					},
					natural: {
						type: "boolean"
					},
					minKeys: {
						type: "integer",
						minimum: 2
					},
					variablesBeforeFunctions: {
						type: "boolean"
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			unsorted: "Object keys are not sorted."
		}
	},

	defaultOptions: [{}],

	create(context) {
		const sourceCode = context.getSourceCode();
		const option = context.options[0];

		const order: "asc" | "desc" =
			option && option.order ? option.order : "asc";

		const caseSensitive =
			option && typeof option.caseSensitive === "boolean"
				? option.caseSensitive
				: false;

		const natural =
			option && typeof option.natural === "boolean"
				? option.natural
				: false;

		const minKeys =
			option && typeof option.minKeys === "number" ? option.minKeys : 2;

		const variablesBeforeFunctions =
			option && typeof option.variablesBeforeFunctions === "boolean"
				? option.variablesBeforeFunctions
				: false;

		/**
		 * Compare two key strings based on the provided options.
		 * This function mimics the behavior of the built-in rule.
		 */
		function compareKeys(a: string, b: string) {
			let keyA = a;
			let keyB = b;

			if (!caseSensitive) {
				keyA = keyA.toLowerCase();
				keyB = keyB.toLowerCase();
			}

			if (natural) {
				return keyA.localeCompare(keyB, undefined, {
					numeric: true
				});
			}

			return keyA.localeCompare(keyB);
		}

		/**
		 * Determines if a property is a function property.
		 */
		function isFunctionProperty(prop: TSESTree.Property) {
			const value = prop.value;
			return (
				!!value &&
				(value.type === "FunctionExpression" ||
					value.type === "ArrowFunctionExpression" ||
					prop.method === true)
			);
		}

		/**
		 * Safely extracts a key name from a Property that we already know
		 * only uses Identifier or Literal keys in the fixer.
		 */
		function getPropertyKeyName(prop: TSESTree.Property) {
			const key = prop.key;
			if (key.type === "Identifier") {
				return key.name;
			}
			if (key.type === "Literal") {
				const value = key.value;
				if (typeof value === "string") {
					return value;
				}
				return String(value);
			}
			return "";
		}

		/**
		 * Build the sorted text from the fixable properties while preserving comments.
		 */
		function buildSortedText(fixableProps: TSESTree.Property[]) {
			const sorted = fixableProps.slice().sort((a, b) => {
				if (variablesBeforeFunctions) {
					const aIsFunc = isFunctionProperty(a);
					const bIsFunc = isFunctionProperty(b);
					if (aIsFunc !== bIsFunc) {
						return aIsFunc ? 1 : -1;
					}
				}

				const aKey = getPropertyKeyName(a);
				const bKey = getPropertyKeyName(b);

				let res = compareKeys(aKey, bKey);
				if (order === "desc") {
					res = -res;
				}
				return res;
			});

			return sorted
				.map((prop) => {
					const leadingComments = sourceCode.getCommentsBefore(prop);
					const trailingComments = sourceCode.getCommentsAfter(prop);

					const leadingText =
						leadingComments.length > 0
							? leadingComments
									.map((comment) =>
										sourceCode.getText(comment)
									)
									.join("\n") + "\n"
							: "";

					const trailingText =
						trailingComments.length > 0
							? "\n" +
								trailingComments
									.map((comment) =>
										sourceCode.getText(comment)
									)
									.join("\n")
							: "";

					return (
						leadingText + sourceCode.getText(prop) + trailingText
					);
				})
				.join(", ");
		}

		/**
		 * Checks an ObjectExpression node for unsorted keys.
		 * Reports an error on each out-of-order key.
		 *
		 * For auto-fix purposes, only simple properties are considered fixable.
		 * (Computed keys, spread elements, or non-Identifier/Literal keys disable the fix.)
		 */
		function checkObjectExpression(node: TSESTree.ObjectExpression) {
			if (node.properties.length < minKeys) {
				return;
			}

			let autoFixable = true;

			const keys: KeyInfo[] = node.properties.map((prop) => {
				let keyName: string | null = null;
				let isFunc = false;

				if (prop.type === "Property") {
					if (prop.computed) {
						autoFixable = false;
					}

					if (prop.key.type === "Identifier") {
						keyName = prop.key.name;
					} else if (prop.key.type === "Literal") {
						const value = prop.key.value;
						keyName =
							typeof value === "string" ? value : String(value);
					} else {
						autoFixable = false;
					}

					if (isFunctionProperty(prop)) {
						isFunc = true;
					}
				} else {
					// Spread elements or other non-Property nodes.
					autoFixable = false;
				}

				return {
					keyName,
					node: prop,
					isFunction: isFunc
				};
			});

			const getFixableProps = () => {
				const props: TSESTree.Property[] = [];
				for (const prop of node.properties) {
					if (prop.type !== "Property") {
						continue;
					}
					if (prop.computed) {
						continue;
					}
					if (
						prop.key.type !== "Identifier" &&
						prop.key.type !== "Literal"
					) {
						continue;
					}
					props.push(prop);
				}
				return props;
			};

			let fixProvided = false;

			for (let i = 1; i < keys.length; i++) {
				const prev = keys[i - 1];
				const curr = keys[i];

				if (!prev || !curr) {
					continue;
				}

				if (prev.keyName === null || curr.keyName === null) {
					continue;
				}

				const shouldFix = !fixProvided && autoFixable;

				const reportWithFix = () => {
					context.report({
						node:
							curr.node.type === "Property"
								? curr.node.key
								: curr.node,
						messageId: "unsorted",
						fix: shouldFix
							? (fixer) => {
									const fixableProps = getFixableProps();
									if (fixableProps.length < minKeys) {
										return null;
									}

									const firstProp = fixableProps[0];
									const lastProp =
										fixableProps[fixableProps.length - 1];

									if (!firstProp || !lastProp) {
										return null;
									}

									const sortedText =
										buildSortedText(fixableProps);

									return fixer.replaceTextRange(
										[firstProp.range[0], lastProp.range[1]],
										sortedText
									);
								}
							: null
					});
					fixProvided = true;
				};

				if (variablesBeforeFunctions) {
					if (prev.isFunction && !curr.isFunction) {
						reportWithFix();
						continue;
					}

					if (
						prev.isFunction === curr.isFunction &&
						compareKeys(prev.keyName, curr.keyName) > 0
					) {
						reportWithFix();
					}
				} else {
					if (compareKeys(prev.keyName, curr.keyName) > 0) {
						reportWithFix();
					}
				}
			}
		}

		// Also check object literals inside JSX prop expressions
		function checkJSXAttributeObject(attr: TSESTree.JSXAttribute) {
			const value = attr.value;
			if (value && value.type === "JSXExpressionContainer") {
				const expr = value.expression;
				if (expr && expr.type === "ObjectExpression") {
					checkObjectExpression(expr);
				}
			}
		}

		// Also sort JSX attributes on elements
		function checkJSXOpeningElement(node: TSESTree.JSXOpeningElement) {
			const attrs = node.attributes;
			if (attrs.length < minKeys) {
				return;
			}

			if (attrs.some((a) => a.type !== "JSXAttribute")) {
				return;
			}
			if (
				attrs.some(
					(a) =>
						a.type === "JSXAttribute" &&
						a.name.type !== "JSXIdentifier"
				)
			) {
				return;
			}

			const names = attrs.map((a) => {
				if (a.type !== "JSXAttribute") {
					return "";
				}
				if (a.name.type !== "JSXIdentifier") {
					return "";
				}
				return a.name.name;
			});

			const cmp = (a: string, b: string) => {
				let res = compareKeys(a, b);
				if (order === "desc") {
					res = -res;
				}
				return res;
			};

			let outOfOrder = false;
			for (let i = 1; i < names.length; i++) {
				const prevName = names[i - 1];
				const currName = names[i];
				if (!prevName || !currName) {
					continue;
				}
				if (cmp(prevName, currName) > 0) {
					outOfOrder = true;
					break;
				}
			}

			if (!outOfOrder) {
				return;
			}

			// Be conservative: only fix if there are no JSX comments/braces between attributes.
			for (let i = 1; i < attrs.length; i++) {
				const prevAttr = attrs[i - 1];
				const currAttr = attrs[i];

				if (!prevAttr || !currAttr) {
					continue;
				}

				const between = sourceCode.text.slice(
					prevAttr.range[1],
					currAttr.range[0]
				);
				if (between.includes("{")) {
					context.report({
						node:
							currAttr.type === "JSXAttribute"
								? currAttr.name
								: currAttr,
						messageId: "unsorted"
					});
					return;
				}
			}

			const sortedAttrs = attrs.slice().sort((a, b) => {
				const aName =
					a.type === "JSXAttribute" && a.name.type === "JSXIdentifier"
						? a.name.name
						: "";
				const bName =
					b.type === "JSXAttribute" && b.name.type === "JSXIdentifier"
						? b.name.name
						: "";
				return cmp(aName, bName);
			});

			const firstAttr = attrs[0];
			const lastAttr = attrs[attrs.length - 1];

			if (!firstAttr || !lastAttr) {
				return;
			}

			const replacement = sortedAttrs
				.map((a) => sourceCode.getText(a))
				.join(" ");

			context.report({
				node:
					firstAttr.type === "JSXAttribute"
						? firstAttr.name
						: firstAttr,
				messageId: "unsorted",
				fix(fixer) {
					return fixer.replaceTextRange(
						[firstAttr.range[0], lastAttr.range[1]],
						replacement
					);
				}
			});
		}

		return {
			ObjectExpression: checkObjectExpression,
			JSXAttribute(node: TSESTree.JSXAttribute) {
				checkJSXAttributeObject(node);
			},
			JSXOpeningElement: checkJSXOpeningElement
		};
	}
};
