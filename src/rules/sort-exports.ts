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

const SORT_BEFORE: -1 = -1;

const getVariableDeclaratorName = (
	declaration: TSESTree.VariableDeclaration
) => {
	if (declaration.declarations.length !== 1) {
		return null;
	}
	const [firstDeclarator] = declaration.declarations;
	if (firstDeclarator && firstDeclarator.id.type === "Identifier") {
		return firstDeclarator.id.name;
	}
	return null;
};

const getDeclarationName = (
	declaration: TSESTree.ExportNamedDeclaration["declaration"]
) => {
	if (!declaration) {
		return null;
	}

	if (declaration.type === "VariableDeclaration") {
		return getVariableDeclaratorName(declaration);
	}

	if (
		(declaration.type === "FunctionDeclaration" ||
			declaration.type === "ClassDeclaration") &&
		declaration.id &&
		declaration.id.type === "Identifier"
	) {
		return declaration.id.name;
	}

	return null;
};

const getSpecifierName = (node: TSESTree.ExportNamedDeclaration) => {
	if (node.specifiers.length !== 1) {
		return null;
	}
	const [spec] = node.specifiers;
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
	return null;
};

const getExportName = (node: TSESTree.ExportNamedDeclaration) =>
	getDeclarationName(node.declaration) ?? getSpecifierName(node);

const isFixableExport = (exportNode: TSESTree.ExportNamedDeclaration) => {
	const { declaration } = exportNode;

	if (!declaration) {
		return exportNode.specifiers.length === 1;
	}

	if (
		declaration.type === "VariableDeclaration" &&
		declaration.declarations.length === 1
	) {
		const [firstDecl] = declaration.declarations;
		return firstDecl !== undefined && firstDecl.id.type === "Identifier";
	}

	return (
		(declaration.type === "FunctionDeclaration" ||
			declaration.type === "ClassDeclaration") &&
		declaration.id !== null &&
		declaration.id.type === "Identifier"
	);
};

export const sortExports: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const { sourceCode } = context;
		const [option] = context.options;

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

		const generateExportText = (node: TSESTree.ExportNamedDeclaration) =>
			sourceCode
				.getText(node)
				.trim()
				.replace(/\s*;?\s*$/, ";");

		const compareStrings = (strLeft: string, strRight: string) => {
			let left = strLeft;
			let right = strRight;

			if (!caseSensitive) {
				left = left.toLowerCase();
				right = right.toLowerCase();
			}

			const cmp = natural
				? left.localeCompare(right, undefined, { numeric: true })
				: left.localeCompare(right);

			return order === "asc" ? cmp : -cmp;
		};

		const isFunctionExport = (node: TSESTree.ExportNamedDeclaration) => {
			const { declaration } = node;

			if (!declaration) {
				return false;
			}

			if (declaration.type === "FunctionDeclaration") {
				return true;
			}

			if (declaration.type !== "VariableDeclaration") {
				return false;
			}

			if (declaration.declarations.length !== 1) {
				return false;
			}

			const [firstDeclarator] = declaration.declarations;
			if (!firstDeclarator) {
				return false;
			}
			const { init } = firstDeclarator;
			if (!init) {
				return false;
			}
			return (
				init.type === "FunctionExpression" ||
				init.type === "ArrowFunctionExpression"
			);
		};

		const sortComparator = (left: ExportItem, right: ExportItem) => {
			const kindA = left.node.exportKind ?? "value";
			const kindB = right.node.exportKind ?? "value";

			if (kindA !== kindB) {
				return kindA === "type" ? SORT_BEFORE : 1;
			}

			if (
				variablesBeforeFunctions &&
				left.isFunction !== right.isFunction
			) {
				return left.isFunction ? 1 : SORT_BEFORE;
			}

			return compareStrings(left.name, right.name);
		};

		/**
		 * Very lightweight dependency check: look at the text of the node and see
		 * if it references any of the later export names.
		 */
		const hasForwardDependency = (
			node: TSESTree.Node,
			laterNames: Set<string>
		) => {
			const text = sourceCode.getText(node);
			for (const name of laterNames) {
				if (text.includes(name)) {
					return true;
				}
			}
			return false;
		};

		const buildItems = (block: TSESTree.ExportNamedDeclaration[]) =>
			block
				.map((node) => {
					const name = getExportName(node);
					if (!name) {
						return null;
					}
					const item: ExportItem = {
						isFunction: isFunctionExport(node),
						name,
						node,
						text: sourceCode.getText(node)
					};
					return item;
				})
				.filter((item): item is ExportItem => item !== null);

		const findFirstUnsorted = (items: ExportItem[]) => {
			let messageId: MessageIds = "alphabetical";

			const unsorted = items.some((current, idx) => {
				if (idx === 0) {
					return false;
				}
				const prev = items[idx - 1];
				if (!prev) {
					return false;
				}
				if (sortComparator(prev, current) <= 0) {
					return false;
				}
				if (
					variablesBeforeFunctions &&
					prev.isFunction &&
					!current.isFunction
				) {
					messageId = "variablesBeforeFunctions";
				}
				return true;
			});

			return unsorted ? messageId : null;
		};

		const checkForwardDependencies = (items: ExportItem[]) => {
			const exportNames = items.map((item) => item.name);
			return items.some((item, idx) => {
				const laterNames = new Set(exportNames.slice(idx + 1));
				const nodeToCheck: TSESTree.Node =
					item.node.declaration ?? item.node;
				return hasForwardDependency(nodeToCheck, laterNames);
			});
		};

		const processExportBlock = (
			block: TSESTree.ExportNamedDeclaration[]
		) => {
			if (block.length < minKeys) {
				return;
			}

			const items = buildItems(block);

			if (items.length < minKeys) {
				return;
			}

			const messageId = findFirstUnsorted(items);
			if (!messageId) {
				return;
			}

			if (checkForwardDependencies(items)) {
				return;
			}

			const sortedItems = items.slice().sort(sortComparator);

			const expectedOrder = sortedItems
				.map((item) => item.name)
				.join(", ");

			const [firstNode] = block;
			const lastNode = block[block.length - 1];

			if (!firstNode || !lastNode) {
				return;
			}

			context.report({
				data: {
					expectedOrder
				},
				fix(fixer) {
					const fixableNodes = block.filter(isFixableExport);

					if (fixableNodes.length < minKeys) {
						return null;
					}

					const sortedText = sortedItems
						.map((item) => generateExportText(item.node))
						.join("\n");

					const [rangeStart] = firstNode.range;
					const [, rangeEnd] = lastNode.range;

					const fullText = sourceCode.getText();
					const originalText = fullText.slice(rangeStart, rangeEnd);

					if (originalText === sortedText) {
						return null;
					}

					return fixer.replaceTextRange(
						[rangeStart, rangeEnd],
						sortedText
					);
				},
				messageId,
				node: firstNode
			});
		};

		return {
			"Program:exit"(node: TSESTree.Program) {
				const { body } = node;
				const block: TSESTree.ExportNamedDeclaration[] = [];

				body.forEach((stmt) => {
					if (
						stmt.type === "ExportNamedDeclaration" &&
						!stmt.source &&
						getExportName(stmt) !== null
					) {
						block.push(stmt);
						return;
					}

					if (block.length > 0) {
						processExportBlock(block);
						block.length = 0;
					}
				});

				if (block.length > 0) {
					processExportBlock(block);
				}
			}
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports"
		},
		fixable: "code",
		messages: {
			alphabetical:
				"Export declarations are not sorted alphabetically. Expected order: {{expectedOrder}}.",
			variablesBeforeFunctions:
				"Non-function exports should come before function exports."
		},
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
