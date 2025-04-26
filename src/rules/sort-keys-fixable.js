/**
 * @fileoverview Enforce sorted keys in object literals (like ESLint’s built-in sort-keys)
 * with an auto-fix for simple cases that preserves comments.
 *
 * Note: This rule reports errors just like the original sort-keys rule.
 * However, the auto-fix only applies if all properties are “fixable” – i.e.:
 *  - They are of type Property (not SpreadElement, etc.)
 *  - They are not computed (e.g. [foo])
 *  - Their key is an Identifier or a Literal.
 *
 * Comments attached to the properties are preserved in the auto-fix.
 *
 * Use this rule with a grain of salt. I did not test every edge case and there’s
 * a reason the original rule doesn’t have auto-fix. Computed keys, spread elements,
 * comments, and formatting are not handled perfectly.
 */

export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)",
			recommended: false
		},
		fixable: "code",
		// The schema supports the same options as the built-in sort-keys rule plus:
		//   variablesBeforeFunctions: boolean (when true, non-function properties come before function properties)
		schema: [
			{
				type: "object",
				properties: {
					order: {
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

	create(context) {
		const sourceCode = context.getSourceCode();
		const options = context.options[0] || {};
		const order = options.order || "asc";
		const caseSensitive =
			options.caseSensitive !== undefined ? options.caseSensitive : false;
		const natural = options.natural !== undefined ? options.natural : false;
		const minKeys = options.minKeys !== undefined ? options.minKeys : 2;
		const variablesBeforeFunctions =
			options.variablesBeforeFunctions !== undefined
				? options.variablesBeforeFunctions
				: false;

		/**
		 * Compare two key strings based on the provided options.
		 * This function mimics the behavior of the built-in rule.
		 *
		 * @param {string} a First key.
		 * @param {string} b Second key.
		 * @returns {number} Negative if a comes before b, positive if after, 0 if equal.
		 */
		function compareKeys(a, b) {
			let keyA = a;
			let keyB = b;
			if (!caseSensitive) {
				keyA = keyA.toLowerCase();
				keyB = keyB.toLowerCase();
			}
			if (natural) {
				return keyA.localeCompare(keyB, undefined, { numeric: true });
			}
			return keyA.localeCompare(keyB);
		}

		/**
		 * Determines if a property is a function property.
		 *
		 * @param {ASTNode} prop The property node.
		 * @returns {boolean} True if the property's value is a function.
		 */
		function isFunctionProperty(prop) {
			return (
				prop.value &&
				(prop.value.type === "FunctionExpression" ||
					prop.value.type === "ArrowFunctionExpression" ||
					prop.method === true)
			);
		}

		/**
		 * Build the sorted text from the fixable properties while preserving comments.
		 *
		 * @param {ASTNode[]} fixableProps Array of fixable property nodes.
		 * @returns {string} The concatenated text representing the sorted properties.
		 */
		function buildSortedText(fixableProps) {
			// Create a sorted copy of the properties.
			const sorted = fixableProps.slice().sort((a, b) => {
				if (variablesBeforeFunctions) {
					const aIsFunc = isFunctionProperty(a);
					const bIsFunc = isFunctionProperty(b);
					if (aIsFunc !== bIsFunc) {
						return aIsFunc ? 1 : -1;
					}
				}
				const keyA =
					a.key.type === "Identifier"
						? a.key.name
						: String(a.key.value);
				const keyB =
					b.key.type === "Identifier"
						? b.key.name
						: String(b.key.value);
				let res = compareKeys(keyA, keyB);
				if (order === "desc") {
					res = -res;
				}
				return res;
			});

			// Reconstruct each property along with its comments.
			return sorted
				.map((prop) => {
					// Retrieve leading and trailing comments.
					const leadingComments =
						sourceCode.getCommentsBefore(prop) || [];
					const trailingComments =
						sourceCode.getCommentsAfter(prop) || [];
					// Assemble the comment text.
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
					// Return the property text with its comments.
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
		 *
		 * @param {ASTNode} node The ObjectExpression node.
		 */
		function checkObjectExpression(node) {
			if (node.properties.length < minKeys) {
				return;
			}

			// Build an array of objects: { keyName, node, isFunction }.
			let autoFixable = true;
			const keys = node.properties.map((prop) => {
				let keyName = null;
				let isFunc = false;
				if (prop.type === "Property") {
					if (prop.computed) {
						// Computed keys are not handled in the fixer.
						autoFixable = false;
					}
					if (prop.key.type === "Identifier") {
						keyName = prop.key.name;
					} else if (prop.key.type === "Literal") {
						keyName = String(prop.key.value);
					} else {
						autoFixable = false;
					}
					// Determine if the property is a function.
					if (prop.value) {
						if (
							prop.value.type === "FunctionExpression" ||
							prop.value.type === "ArrowFunctionExpression" ||
							prop.method === true
						) {
							isFunc = true;
						}
					}
				} else {
					// Spread elements or other non-Property nodes.
					autoFixable = false;
				}
				return { keyName, node: prop, isFunction: isFunc };
			});

			// Report an error for each adjacent pair of keys that is out of order.
			// For auto-fix, only the first reported error for a given object gets a fix function.
			let fixProvided = false;
			for (let i = 1; i < keys.length; i++) {
				const prev = keys[i - 1];
				const curr = keys[i];

				// Skip comparison if keyName is null.
				if (prev.keyName === null || curr.keyName === null) {
					continue;
				}

				if (variablesBeforeFunctions) {
					// When sorting variables before functions, if the previous property is a function and the current one is not,
					// then they are out of order.
					if (prev.isFunction && !curr.isFunction) {
						context.report({
							node: curr.node.key,
							messageId: "unsorted",
							fix:
								!fixProvided && autoFixable
									? (fixer) => {
											const fixableProps =
												node.properties.filter(
													(prop) =>
														prop.type ===
															"Property" &&
														!prop.computed &&
														(prop.key.type ===
															"Identifier" ||
															prop.key.type ===
																"Literal")
												);
											if (fixableProps.length < minKeys) {
												return null;
											}
											const sortedText =
												buildSortedText(fixableProps);
											const firstProp = fixableProps[0];
											const lastProp =
												fixableProps[
													fixableProps.length - 1
												];
											return fixer.replaceTextRange(
												[
													firstProp.range[0],
													lastProp.range[1]
												],
												sortedText
											);
										}
									: null
						});
						fixProvided = true;
						continue;
					} else if (prev.isFunction === curr.isFunction) {
						// If both properties are of the same type, compare keys alphabetically.
						if (compareKeys(prev.keyName, curr.keyName) > 0) {
							context.report({
								node: curr.node.key,
								messageId: "unsorted",
								fix:
									!fixProvided && autoFixable
										? (fixer) => {
												const fixableProps =
													node.properties.filter(
														(prop) =>
															prop.type ===
																"Property" &&
															!prop.computed &&
															(prop.key.type ===
																"Identifier" ||
																prop.key
																	.type ===
																	"Literal")
													);
												if (
													fixableProps.length <
													minKeys
												) {
													return null;
												}
												const sortedText =
													buildSortedText(
														fixableProps
													);
												const firstProp =
													fixableProps[0];
												const lastProp =
													fixableProps[
														fixableProps.length - 1
													];
												return fixer.replaceTextRange(
													[
														firstProp.range[0],
														lastProp.range[1]
													],
													sortedText
												);
											}
										: null
							});
							fixProvided = true;
						}
					}
				} else {
					// Original behavior: compare keys alphabetically.
					if (compareKeys(prev.keyName, curr.keyName) > 0) {
						context.report({
							node: curr.node.key,
							messageId: "unsorted",
							fix:
								!fixProvided && autoFixable
									? (fixer) => {
											const fixableProps =
												node.properties.filter(
													(prop) =>
														prop.type ===
															"Property" &&
														!prop.computed &&
														(prop.key.type ===
															"Identifier" ||
															prop.key.type ===
																"Literal")
												);
											if (fixableProps.length < minKeys) {
												return null;
											}
											const sortedText =
												buildSortedText(fixableProps);
											const firstProp = fixableProps[0];
											const lastProp =
												fixableProps[
													fixableProps.length - 1
												];
											return fixer.replaceTextRange(
												[
													firstProp.range[0],
													lastProp.range[1]
												],
												sortedText
											);
										}
									: null
						});
						fixProvided = true;
					}
				}
			}
		}

		return {
			ObjectExpression: checkObjectExpression
		};
	}
};
