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
	create(context) {
		const { sourceCode } = context;
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
			const { value } = prop;
			return (
				Boolean(value) &&
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
			const { key } = prop;
			if (key.type === "Identifier") {
				return key.name;
			}
			if (key.type === "Literal") {
				const { value } = key;
				if (typeof value === "string") {
					return value;
				}
				return String(value);
			}
			return "";
		}

		/**
		 * Get leading comments for a property, excluding any comments that
		 * are on the same line as the previous property (those are trailing
		 * comments of the previous property).
		 */
		function getLeadingComments(
			prop: TSESTree.Property,
			prevProp: TSESTree.Property | null
		): TSESTree.Comment[] {
			const comments = sourceCode.getCommentsBefore(prop);
			if (!prevProp || comments.length === 0) {
				return comments;
			}
			// Filter out comments on the same line as the previous property
			return comments.filter(
				(c) => c.loc.start.line !== prevProp.loc.end.line
			);
		}

		/**
		 * Get trailing comments for a property that are on the same line.
		 * This includes both getCommentsAfter AND any getCommentsBefore of the
		 * next property that are on the same line as this property.
		 */
		function getTrailingComments(
			prop: TSESTree.Property,
			nextProp: TSESTree.Property | null
		): TSESTree.Comment[] {
			const after = sourceCode
				.getCommentsAfter(prop)
				.filter((c) => c.loc.start.line === prop.loc.end.line);
			if (nextProp) {
				const beforeNext = sourceCode.getCommentsBefore(nextProp);
				const trailingOfPrev = beforeNext.filter(
					(c) => c.loc.start.line === prop.loc.end.line
				);
				// Merge, avoiding duplicates
				for (const c of trailingOfPrev) {
					if (!after.some((a) => a.range[0] === c.range[0])) {
						after.push(c);
					}
				}
			}
			return after;
		}

		/**
		 * Build the sorted text from the fixable properties while preserving
		 * comments and formatting.
		 */
		function buildSortedText(
			fixableProps: TSESTree.Property[],
			rangeStart: number
		) {
			// For each property, capture its "chunk": the property text plus
			// its associated comments (leading comments on separate lines,
			// trailing comments on the same line).
			const chunks: {
				prop: TSESTree.Property;
				text: string;
			}[] = [];

			for (let i = 0; i < fixableProps.length; i++) {
				const prop = fixableProps[i]!;
				const prevProp = i > 0 ? fixableProps[i - 1]! : null;
				const nextProp =
					i < fixableProps.length - 1 ? fixableProps[i + 1]! : null;

				const leading = getLeadingComments(prop, prevProp);
				const trailing = getTrailingComments(prop, nextProp);

				const fullStart =
					leading.length > 0 ? leading[0]!.range[0] : prop.range[0];
				const fullEnd =
					trailing.length > 0
						? trailing[trailing.length - 1]!.range[1]
						: prop.range[1];

				// Find the chunk start (after previous property's separator)
				let chunkStart: number;
				if (i === 0) {
					chunkStart = rangeStart;
				} else {
					const prevTrailing = getTrailingComments(prevProp!, prop);
					const prevEnd =
						prevTrailing.length > 0
							? prevTrailing[prevTrailing.length - 1]!.range[1]
							: prevProp!.range[1];
					// Find the comma after the previous property/comments
					const tokenAfterPrev = sourceCode.getTokenAfter(
						{
							range: [prevEnd, prevEnd]
						} as TSESTree.Node,
						{ includeComments: false }
					);
					if (
						tokenAfterPrev &&
						tokenAfterPrev.value === "," &&
						tokenAfterPrev.range[1] <= fullStart
					) {
						chunkStart = tokenAfterPrev.range[1];
					} else {
						chunkStart = prevEnd;
					}
				}

				const text = sourceCode.text.slice(chunkStart, fullEnd);
				chunks.push({ prop, text });
			}

			// Sort the chunks
			const sorted = chunks.slice().sort((a, b) => {
				if (variablesBeforeFunctions) {
					const aIsFunc = isFunctionProperty(a.prop);
					const bIsFunc = isFunctionProperty(b.prop);
					if (aIsFunc !== bIsFunc) {
						return aIsFunc ? 1 : -1;
					}
				}

				const aKey = getPropertyKeyName(a.prop);
				const bKey = getPropertyKeyName(b.prop);

				let res = compareKeys(aKey, bKey);
				if (order === "desc") {
					res = -res;
				}
				return res;
			});

			// Detect separator: check if the object is multiline by comparing
			// the first and last property lines. If multiline, use the
			// indentation of the first property.
			const firstPropLine = fixableProps[0]!.loc.start.line;
			const lastPropLine =
				fixableProps[fixableProps.length - 1]!.loc.start.line;
			const isMultiline = firstPropLine !== lastPropLine;
			let separator: string;
			if (isMultiline) {
				// Detect indentation from the first property's column
				const col = fixableProps[0]!.loc.start.column;
				const indent = sourceCode.text.slice(
					fixableProps[0]!.range[0] - col,
					fixableProps[0]!.range[0]
				);
				separator = `,\n${indent}`;
			} else {
				separator = ", ";
			}

			// Rebuild: first chunk keeps original leading whitespace,
			// subsequent chunks use the detected separator
			return sorted
				.map((chunk, i) => {
					if (i === 0) {
						const originalFirstChunk = chunks[0]!;
						const originalLeadingWs =
							originalFirstChunk.text.match(/^(\s*)/)?.[1] ?? "";
						const stripped = chunk.text.replace(/^\s*/, "");
						return originalLeadingWs + stripped;
					}
					const stripped = chunk.text.replace(/^\s*/, "");
					return separator + stripped;
				})
				.join("");
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
						const { value } = prop.key;
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
					isFunction: isFunc,
					keyName,
					node: prop
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

									const firstLeading = getLeadingComments(
										firstProp,
										null
									);
									const rangeStart =
										firstLeading.length > 0
											? firstLeading[0]!.range[0]
											: firstProp.range[0];
									const lastTrailing = getTrailingComments(
										lastProp,
										null
									);
									const rangeEnd =
										lastTrailing.length > 0
											? lastTrailing[
													lastTrailing.length - 1
												]!.range[1]
											: lastProp.range[1];
									const sortedText = buildSortedText(
										fixableProps,
										rangeStart
									);

									return fixer.replaceTextRange(
										[rangeStart, rangeEnd],
										sortedText
									);
								}
							: null,
						messageId: "unsorted",
						node:
							curr.node.type === "Property"
								? curr.node.key
								: curr.node
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
			const { value } = attr;
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
						messageId: "unsorted",
						node:
							currAttr.type === "JSXAttribute"
								? currAttr.name
								: currAttr
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
				fix(fixer) {
					return fixer.replaceTextRange(
						[firstAttr.range[0], lastAttr.range[1]],
						replacement
					);
				},
				messageId: "unsorted",
				node:
					firstAttr.type === "JSXAttribute"
						? firstAttr.name
						: firstAttr
			});
		}

		return {
			JSXAttribute(node: TSESTree.JSXAttribute) {
				checkJSXAttributeObject(node);
			},
			JSXOpeningElement: checkJSXOpeningElement,
			ObjectExpression: checkObjectExpression
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)"
		},
		fixable: "code",
		messages: {
			unsorted: "Object keys are not sorted."
		},
		// The schema supports the same options as the built-in sort-keys rule plus:
		//   variablesBeforeFunctions: boolean (when true, non-function properties come before function properties)
		schema: [
			{
				additionalProperties: false,
				properties: {
					caseSensitive: {
						type: "boolean"
					},
					minKeys: {
						minimum: 2,
						type: "integer"
					},
					natural: {
						type: "boolean"
					},
					order: {
						enum: ["asc", "desc"],
						type: "string"
					},
					variablesBeforeFunctions: {
						type: "boolean"
					}
				},
				type: "object"
			}
		],
		type: "suggestion"
	}
};
