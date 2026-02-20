import { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * @fileoverview Enforce that top-level export declarations are sorted.
 *
 * This rule supports the following options:
 *  - order: "asc" or "desc" (default: "asc")
 *  - caseSensitive: boolean (default: false)
 *  - natural: boolean (default: false)
 *  - minKeys: integer, minimum number of exports in a contiguous block to check (default: 2)
 *  - variablesBeforeFunctions: boolean (default: false)
 */

type SortExportsOptions = {
	order?: "asc" | "desc";
	caseSensitive?: boolean;
	natural?: boolean;
	minKeys?: number;
	variablesBeforeFunctions?: boolean;
};

type Options = [SortExportsOptions?];

type MessageIds = "alphabetical" | "variablesBeforeFunctions";

type ExportItem = {
	name: string;
	node: TSESTree.ExportNamedDeclaration;
	isFunction: boolean;
	text: string;
};

export const sortExports: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports"
		},
		fixable: "code",
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
			alphabetical:
				"Export declarations are not sorted alphabetically. Expected order: {{expectedOrder}}.",
			variablesBeforeFunctions:
				"Non-function exports should come before function exports."
		}
	},

	defaultOptions: [{}],

	create(context) {
		const sourceCode = context.sourceCode;
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

		function generateExportText(node: TSESTree.ExportNamedDeclaration) {
			return sourceCode
				.getText(node)
				.trim()
				.replace(/\s*;?\s*$/, ";");
		}

		function compareStrings(a: string, b: string) {
			let strA = a;
			let strB = b;

			if (!caseSensitive) {
				strA = strA.toLowerCase();
				strB = strB.toLowerCase();
			}

			const cmp = natural
				? strA.localeCompare(strB, undefined, { numeric: true })
				: strA.localeCompare(strB);

			return order === "asc" ? cmp : -cmp;
		}

		function getExportName(
			node: TSESTree.ExportNamedDeclaration
		): string | null {
			const declaration = node.declaration;

			if (declaration) {
				if (declaration.type === "VariableDeclaration") {
					if (declaration.declarations.length === 1) {
						const firstDeclarator = declaration.declarations[0];
						if (
							firstDeclarator &&
							firstDeclarator.id.type === "Identifier"
						) {
							return firstDeclarator.id.name;
						}
					}
				} else if (
					declaration.type === "FunctionDeclaration" ||
					declaration.type === "ClassDeclaration"
				) {
					const id = declaration.id;
					if (id && id.type === "Identifier") {
						return id.name;
					}
				}
			} else if (node.specifiers.length === 1) {
				const spec = node.specifiers[0];
				if (!spec) {
					return null;
				}
				if (spec.exported.type === "Identifier") {
					return spec.exported.name;
				}
				if (
					spec.exported.type === "Literal" &&
					typeof spec.exported.value === "string"
				) {
					return spec.exported.value;
				}
			}

			return null;
		}

		function isFunctionExport(node: TSESTree.ExportNamedDeclaration) {
			const declaration = node.declaration;

			if (!declaration) {
				return false;
			}

			if (declaration.type === "VariableDeclaration") {
				if (declaration.declarations.length === 1) {
					const firstDeclarator = declaration.declarations[0];
					if (!firstDeclarator) {
						return false;
					}
					const init = firstDeclarator.init;
					if (!init) {
						return false;
					}
					return (
						init.type === "FunctionExpression" ||
						init.type === "ArrowFunctionExpression"
					);
				}
				return false;
			}

			if (declaration.type === "FunctionDeclaration") {
				return true;
			}

			return false;
		}

		function sortComparator(a: ExportItem, b: ExportItem) {
			const kindA = a.node.exportKind ?? "value";
			const kindB = b.node.exportKind ?? "value";

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
		 * Very lightweight dependency check: look at the text of the node and see
		 * if it references any of the later export names. This avoids reordering
		 * when there might be a forward dependency.
		 */
		function hasForwardDependency(
			node: TSESTree.Node,
			laterNames: Set<string>
		) {
			const text = sourceCode.getText(node);
			for (const name of laterNames) {
				if (text.includes(name)) {
					return true;
				}
			}
			return false;
		}

		function processExportBlock(block: TSESTree.ExportNamedDeclaration[]) {
			if (block.length < minKeys) {
				return;
			}

			const items: ExportItem[] = [];

			for (const node of block) {
				const name = getExportName(node);
				if (!name) {
					continue;
				}

				items.push({
					name,
					node,
					isFunction: isFunctionExport(node),
					text: sourceCode.getText(node)
				});
			}

			if (items.length < minKeys) {
				return;
			}

			const sortedItems = items.slice().sort(sortComparator);

			let reportNeeded = false;
			let messageId: MessageIds = "alphabetical";

			for (let i = 1; i < items.length; i++) {
				const prev = items[i - 1];
				const current = items[i];

				if (!prev || !current) {
					continue;
				}

				if (sortComparator(prev, current) > 0) {
					reportNeeded = true;

					if (
						variablesBeforeFunctions &&
						prev.isFunction &&
						!current.isFunction
					) {
						messageId = "variablesBeforeFunctions";
					}
					break;
				}
			}

			if (!reportNeeded) {
				return;
			}

			const exportNames = items.map((item) => item.name);

			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!item) {
					continue;
				}
				const laterNames = new Set(exportNames.slice(i + 1));
				const nodeToCheck: TSESTree.Node =
					item.node.declaration ?? item.node;

				if (hasForwardDependency(nodeToCheck, laterNames)) {
					return;
				}
			}

			const expectedOrder = sortedItems
				.map((item) => item.name)
				.join(", ");

			const firstNode = block[0];
			const lastNode = block[block.length - 1];

			if (!firstNode || !lastNode) {
				return;
			}

			context.report({
				node: firstNode,
				messageId,
				data: {
					expectedOrder
				},
				fix(fixer) {
					const fixableNodes: TSESTree.ExportNamedDeclaration[] = [];

					for (const n of block) {
						const declaration = n.declaration;

						if (declaration) {
							if (
								declaration.type === "VariableDeclaration" &&
								declaration.declarations.length === 1
							) {
								const firstDecl = declaration.declarations[0];
								if (
									firstDecl &&
									firstDecl.id.type === "Identifier"
								) {
									fixableNodes.push(n);
									continue;
								}
							}

							if (
								(declaration.type === "FunctionDeclaration" ||
									declaration.type === "ClassDeclaration") &&
								declaration.id &&
								declaration.id.type === "Identifier"
							) {
								fixableNodes.push(n);
								continue;
							}

							continue;
						}

						if (n.specifiers.length === 1) {
							fixableNodes.push(n);
						}
					}

					if (fixableNodes.length < minKeys) {
						return null;
					}

					const sortedText = sortedItems
						.map((item) => generateExportText(item.node))
						.join("\n");

					const rangeStart = firstNode.range[0];
					const rangeEnd = lastNode.range[1];

					const fullText = sourceCode.getText();
					const originalText = fullText.slice(rangeStart, rangeEnd);

					if (originalText === sortedText) {
						return null;
					}

					return fixer.replaceTextRange(
						[rangeStart, rangeEnd],
						sortedText
					);
				}
			});
		}

		return {
			"Program:exit"(node: TSESTree.Program) {
				const body = node.body;
				const block: TSESTree.ExportNamedDeclaration[] = [];

				for (let i = 0; i < body.length; i++) {
					const stmt = body[i];
					if (!stmt) {
						continue;
					}

					if (
						stmt.type === "ExportNamedDeclaration" &&
						!stmt.source &&
						getExportName(stmt) !== null
					) {
						block.push(stmt);
					} else {
						if (block.length > 0) {
							processExportBlock(block);
							block.length = 0;
						}
					}
				}

				if (block.length > 0) {
					processExportBlock(block);
				}
			}
		};
	}
};
