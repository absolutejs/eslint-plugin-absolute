/**
 * @fileoverview Enforce that top-level export declarations are sorted.
 *
 * This rule supports the following options:
 *  - order: "asc" or "desc" (default: "asc")
 *  - caseSensitive: boolean (default: false)
 *  - natural: boolean (default: false)
 *  - minKeys: integer, minimum number of exports in a contiguous block to check (default: 2)
 *  - variablesBeforeFunctions: boolean (default: false)
 *
 * For example, given this code:
 *
 *     export const a = 1;
 *     export const c = 2;
 *     export const b = 3;
 *
 * The rule will report an error and auto-fix it (if run with --fix) to:
 *
 *     export const a = 1;
 *     export const b = 3;
 *     export const c = 2;
 *
 * When variablesBeforeFunctions is true, exports whose values are functions should come after
 * exports whose values are not functions.
 */

export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports",
			category: "Stylistic Issues",
			recommended: false
		},
		fixable: "code",
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
			alphabetical:
				"Export declarations are not sorted alphabetically. Expected order: {{expectedOrder}}.",
			variablesBeforeFunctions:
				"Non-function exports should come before function exports."
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
		 * Helper to generate normalized export text.
		 * @param {ASTNode} node
		 * @returns {string}
		 */
		function generateExportText(node) {
			// Normalize by trimming and ensuring a consistent semicolon.
			return sourceCode
				.getText(node)
				.trim()
				.replace(/\s*;?\s*$/, ";");
		}

		/**
		 * Compare two strings using the options.
		 * @param {string} a
		 * @param {string} b
		 * @returns {number}
		 */
		function compareStrings(a, b) {
			let strA = a;
			let strB = b;
			if (!caseSensitive) {
				strA = strA.toLowerCase();
				strB = strB.toLowerCase();
			}
			let cmp = natural
				? strA.localeCompare(strB, undefined, { numeric: true })
				: strA.localeCompare(strB);
			return order === "asc" ? cmp : -cmp;
		}

		/**
		 * Extracts the exported name from an ExportNamedDeclaration.
		 * Supports declarations (e.g. export const a = 1) with a single declarator
		 * and export specifiers (e.g. export { a }).
		 * @param {ASTNode} node
		 * @returns {string|null}
		 */
		function getExportName(node) {
			if (node.declaration) {
				const decl = node.declaration;
				if (decl.type === "VariableDeclaration") {
					if (decl.declarations.length === 1) {
						const id = decl.declarations[0].id;
						if (id.type === "Identifier") {
							return id.name;
						}
					}
				} else if (
					decl.type === "FunctionDeclaration" ||
					decl.type === "ClassDeclaration"
				) {
					if (decl.id && decl.id.type === "Identifier") {
						return decl.id.name;
					}
				}
			} else if (node.specifiers && node.specifiers.length === 1) {
				const spec = node.specifiers[0];
				return spec.exported.name || spec.exported.value;
			}
			return null;
		}

		/**
		 * Determines if the export is a function export.
		 * @param {ASTNode} node
		 * @returns {boolean}
		 */
		function isFunctionExport(node) {
			if (node.declaration) {
				const decl = node.declaration;
				if (decl.type === "VariableDeclaration") {
					if (decl.declarations.length === 1) {
						const init = decl.declarations[0].init;
						return (
							init &&
							(init.type === "FunctionExpression" ||
								init.type === "ArrowFunctionExpression")
						);
					}
				} else if (decl.type === "FunctionDeclaration") {
					return true;
				}
				// Treat ClassDeclaration as non-function by default (can be adjusted if desired)
				return false;
			}
			// For export specifiers, we cannot reliably tell.
			return false;
		}

		/**
		 * Comparator that implements the full sort order.
		 * - First, type exports (exportKind: "type") come before value exports.
		 * - Next, if variablesBeforeFunctions is enabled, non-function exports come before function exports.
		 * - Finally, sort by name using the provided options.
		 * @param {object} a
		 * @param {object} b
		 * @returns {number}
		 */
		function sortComparator(a, b) {
			const kindA = a.node.exportKind || "value";
			const kindB = b.node.exportKind || "value";
			if (kindA !== kindB) {
				return kindA === "type" ? -1 : 1;
			}
			if (variablesBeforeFunctions) {
				if (a.isFunction !== b.isFunction) {
					return a.isFunction ? 1 : -1;
				}
			}
			return compareStrings(a.name, b.name);
		}

		/**
		 * Recursively traverses a node to check for Identifier references.
		 * Returns true if any Identifier matches one of the names in laterNames.
		 * Uses a WeakSet to avoid infinite recursion on cyclic structures.
		 * @param {ASTNode} node
		 * @param {Set<string>} laterNames
		 * @param {WeakSet<Object>} visited
		 * @returns {boolean}
		 */
		function hasForwardDependency(
			node,
			laterNames,
			visited = new WeakSet()
		) {
			if (!node || typeof node !== "object") {
				return false;
			}
			if (visited.has(node)) {
				return false;
			}
			visited.add(node);

			if (node.type === "Identifier" && laterNames.has(node.name)) {
				return true;
			}

			for (const key in node) {
				if (Object.prototype.hasOwnProperty.call(node, key)) {
					const value = node[key];
					if (Array.isArray(value)) {
						for (const element of value) {
							if (element && typeof element === "object") {
								if (
									hasForwardDependency(
										element,
										laterNames,
										visited
									)
								) {
									return true;
								}
							}
						}
					} else if (value && typeof value === "object") {
						if (hasForwardDependency(value, laterNames, visited)) {
							return true;
						}
					}
				}
			}
			return false;
		}

		/**
		 * Process a contiguous block of eligible ExportNamedDeclaration nodes.
		 * @param {ASTNode[]} block
		 */
		function processExportBlock(block) {
			if (block.length < minKeys) {
				return;
			}

			const items = block
				.map((node) => {
					const name = getExportName(node);
					if (name === null) {
						return null;
					}
					return {
						name,
						node,
						isFunction: isFunctionExport(node),
						text: sourceCode.getText(node)
					};
				})
				.filter(Boolean);

			if (items.length < minKeys) {
				return;
			}

			// Create a sorted copy using our comparator.
			const sortedItems = items.slice().sort(sortComparator);

			// Determine if the block is unsorted.
			let reportNeeded = false;
			let messageId = "alphabetical";
			for (let i = 1; i < items.length; i++) {
				if (sortComparator(items[i - 1], items[i]) > 0) {
					reportNeeded = true;
					if (
						variablesBeforeFunctions &&
						items[i - 1].isFunction &&
						!items[i].isFunction
					) {
						messageId = "variablesBeforeFunctions";
					}
					break;
				}
			}

			// If already sorted, do nothing.
			if (!reportNeeded) {
				return;
			}

			// Dependency check: if any export in the block references a later export,
			// skip reporting an error (to preserve the dependency order).
			const exportNames = items.map((item) => item.name);
			for (let i = 0; i < items.length; i++) {
				const laterNames = new Set(exportNames.slice(i + 1));
				const nodeToCheck = items[i].node.declaration || items[i].node;
				if (hasForwardDependency(nodeToCheck, laterNames)) {
					// A forward dependency exists; do not report an error for this block.
					return;
				}
			}

			// Report the error only if there is no dependency issue.
			const expectedOrder = sortedItems
				.map((item) => item.name)
				.join(", ");
			context.report({
				node: items[0].node,
				messageId,
				data: {
					expectedOrder
				},
				fix(fixer) {
					// Only fix if all nodes in the block are fixable.
					const fixableNodes = block.filter((n) => {
						if (n.declaration) {
							if (
								n.declaration.type === "VariableDeclaration" &&
								n.declaration.declarations.length === 1 &&
								n.declaration.declarations[0].id.type ===
									"Identifier"
							) {
								return true;
							}
							if (
								(n.declaration.type === "FunctionDeclaration" ||
									n.declaration.type ===
										"ClassDeclaration") &&
								n.declaration.id &&
								n.declaration.id.type === "Identifier"
							) {
								return true;
							}
							return false;
						}
						if (n.specifiers && n.specifiers.length === 1) {
							return true;
						}
						return false;
					});
					if (fixableNodes.length < minKeys) {
						return null;
					}
					const sortedText = sortedItems
						.map((item) => generateExportText(item.node))
						.join("\n");
					const first = block[0].range[0];
					const last = block[block.length - 1].range[1];
					// Prevent circular fixes: only apply the change if the text differs.
					const originalText = sourceCode
						.getText()
						.slice(first, last);
					if (originalText === sortedText) {
						return null;
					}
					return fixer.replaceTextRange([first, last], sortedText);
				}
			});
		}

		return {
			"Program:exit"(node) {
				const body = node.body;
				let block = [];
				for (let i = 0; i < body.length; i++) {
					const n = body[i];
					if (
						n.type === "ExportNamedDeclaration" &&
						!n.source && // skip re-exports like export * from '...'
						getExportName(n) !== null
					) {
						block.push(n);
					} else {
						if (block.length) {
							processExportBlock(block);
							block = [];
						}
					}
				}
				if (block.length) {
					processExportBlock(block);
				}
			}
		};
	}
};
