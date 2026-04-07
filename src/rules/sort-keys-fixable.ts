import { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * @fileoverview Enforce sorted keys in object literals (like ESLint's built-in sort-keys)
 * with an auto-fix for simple cases that preserves comments.
 *
 * Note: This rule reports errors just like the original sort-keys rule.
 * However, the auto-fix only applies if all properties are "fixable" – i.e.:
 *  - They are of type Property (not SpreadElement, etc.)
 *  - They are not computed (e.g. [foo])
 *  - They are an Identifier or a Literal.
 *
 * Comments attached to the properties are preserved in the auto-fix.
 *
 * Use this rule with a grain of salt. I did not test every edge case and there's
 * a reason the original rule doesn't have auto-fix. Computed keys, spread elements,
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

type TopLevelBinding =
	| {
			kind: "function";
			node:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression;
	  }
	| {
			kind: "import";
	  }
	| {
			kind: "value";
			node: TSESTree.Expression;
	  };

const SORT_BEFORE = -1;
const PURE_CONSTRUCTORS = new Set(["Date"]);
const PURE_GLOBAL_FUNCTIONS = new Set(["Boolean", "Number", "String"]);
const PURE_MEMBER_METHODS = new Set([
	"getDay",
	"getHours",
	"getMilliseconds",
	"getMinutes",
	"getSeconds",
	"padStart"
]);

const hasDuplicateNames = (names: Array<string | null>) => {
	const seen = new Set<string>();
	const nonNullNames = names.flatMap((name) => (name === null ? [] : [name]));

	for (const name of nonNullNames) {
		if (seen.has(name)) {
			return true;
		}
		seen.add(name);
	}

	return false;
};

export const sortKeysFixable: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const { sourceCode } = context;
		const [option] = context.options;
		const topLevelBindings = new Map<string, TopLevelBinding>();
		const pureFunctionCache = new Map<TSESTree.Node, boolean>();
		const pureFunctionInProgress = new Set<TSESTree.Node>();

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
		const compareKeys = (keyLeft: string, keyRight: string) => {
			let left = keyLeft;
			let right = keyRight;

			if (!caseSensitive) {
				left = left.toLowerCase();
				right = right.toLowerCase();
			}

			if (natural) {
				return left.localeCompare(right, undefined, {
					numeric: true
				});
			}

			return left.localeCompare(right);
		};

		const addImportBindings = (statement: TSESTree.ImportDeclaration) => {
			if (statement.specifiers.length === 0) {
				return;
			}

			for (const specifier of statement.specifiers) {
				topLevelBindings.set(specifier.local.name, {
					kind: "import"
				});
			}
		};

		const addVariableBinding = (
			declaration: TSESTree.VariableDeclarator
		) => {
			if (declaration.id.type !== "Identifier" || !declaration.init) {
				return;
			}

			if (
				declaration.init.type === "ArrowFunctionExpression" ||
				declaration.init.type === "FunctionExpression"
			) {
				topLevelBindings.set(declaration.id.name, {
					kind: "function",
					node: declaration.init
				});
				return;
			}

			topLevelBindings.set(declaration.id.name, {
				kind: "value",
				node: declaration.init
			});
		};

		const addTopLevelBindings = (statement: TSESTree.ProgramStatement) => {
			if (statement.type === "ImportDeclaration") {
				addImportBindings(statement);
				return;
			}

			if (statement.type === "FunctionDeclaration" && statement.id) {
				topLevelBindings.set(statement.id.name, {
					kind: "function",
					node: statement
				});
				return;
			}

			if (
				statement.type !== "VariableDeclaration" ||
				statement.kind !== "const"
			) {
				return;
			}

			for (const declaration of statement.declarations) {
				addVariableBinding(declaration);
			}
		};

		for (const statement of sourceCode.ast.body) {
			addTopLevelBindings(statement);
		}

		const addBoundIdentifiers = (
			node: TSESTree.Node | null,
			stableLocals: Set<string>
		) => {
			if (!node) {
				return;
			}

			switch (node.type) {
				case "Identifier":
					stableLocals.add(node.name);
					return;
				case "AssignmentPattern":
					addBoundIdentifiers(node.left, stableLocals);
					return;
				case "RestElement":
					addBoundIdentifiers(node.argument, stableLocals);
					return;
				case "ArrayPattern":
					for (const element of node.elements.filter(Boolean)) {
						addBoundIdentifiers(element, stableLocals);
					}
					break;
				case "ObjectPattern":
					for (const property of node.properties) {
						const bindingNode =
							property.type === "RestElement"
								? property.argument
								: property.value;
						addBoundIdentifiers(bindingNode, stableLocals);
					}
					break;
				default:
					break;
			}
		};

		const addFunctionParamBindings = (
			functionNode:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression,
			stableLocals: Set<string>
		) => {
			for (const parameter of functionNode.params) {
				addBoundIdentifiers(parameter, stableLocals);
			}
		};

		const addAncestorConstBindings = (
			ancestor: TSESTree.BlockStatement | TSESTree.Program,
			node: TSESTree.Node,
			stableLocals: Set<string>
		) => {
			const addDeclarationBindings = (statement: TSESTree.Statement) => {
				if (
					statement.type !== "VariableDeclaration" ||
					statement.kind !== "const"
				) {
					return;
				}

				for (const declaration of statement.declarations) {
					addBoundIdentifiers(declaration.id, stableLocals);
				}
			};

			for (const statement of ancestor.body) {
				if (statement.range[0] >= node.range[0]) {
					return;
				}

				addDeclarationBindings(statement);
			}
		};

		const addAncestorBindingsForNode = (
			ancestor: TSESTree.Node,
			node: TSESTree.Node,
			stableLocals: Set<string>
		) => {
			if (
				ancestor.type !== "Program" &&
				ancestor.type !== "BlockStatement"
			) {
				return;
			}

			addAncestorConstBindings(ancestor, node, stableLocals);
		};

		const addFunctionBindingsForAncestor = (
			ancestor: TSESTree.Node,
			stableLocals: Set<string>
		) => {
			if (
				ancestor.type !== "FunctionDeclaration" &&
				ancestor.type !== "FunctionExpression" &&
				ancestor.type !== "ArrowFunctionExpression"
			) {
				return;
			}

			addFunctionParamBindings(ancestor, stableLocals);
		};

		const getStableLocalsForNode = (node: TSESTree.Node) => {
			const stableLocals = new Set<string>();
			const ancestors = sourceCode.getAncestors(node);

			for (const ancestor of ancestors) {
				addFunctionBindingsForAncestor(ancestor, stableLocals);
			}

			for (const ancestor of ancestors) {
				addAncestorBindingsForNode(ancestor, node, stableLocals);
			}

			return stableLocals;
		};

		const getStaticMemberName = (
			memberExpression: TSESTree.MemberExpression
		) => {
			if (
				!memberExpression.computed &&
				memberExpression.property.type === "Identifier"
			) {
				return memberExpression.property.name;
			}

			if (
				memberExpression.computed &&
				memberExpression.property.type === "Literal" &&
				typeof memberExpression.property.value === "string"
			) {
				return memberExpression.property.value;
			}

			return null;
		};

		const isStableIdentifier = (
			name: string,
			stableLocals: ReadonlySet<string>
		) => {
			if (stableLocals.has(name)) {
				return true;
			}

			const binding = topLevelBindings.get(name);
			if (!binding) {
				return false;
			}

			if (binding.kind === "import") {
				return true;
			}

			if (binding.kind === "value") {
				return isPureRuntimeExpression(binding.node, stableLocals);
			}

			return false;
		};

		const isPureConstStatement = (
			statement: TSESTree.VariableDeclaration,
			stableLocals: Set<string>,
			checkExpression: (expression: TSESTree.Expression) => boolean
		) => {
			if (statement.kind !== "const") {
				return false;
			}

			for (const declaration of statement.declarations) {
				if (declaration.id.type !== "Identifier" || !declaration.init) {
					return false;
				}

				if (!checkExpression(declaration.init)) {
					return false;
				}

				stableLocals.add(declaration.id.name);
			}

			return true;
		};

		const isPureFunctionStatement = (
			statement: TSESTree.Statement,
			stableLocals: Set<string>,
			checkExpression: (expression: TSESTree.Expression) => boolean
		) => {
			if (statement.type === "ReturnStatement") {
				return (
					!statement.argument || checkExpression(statement.argument)
				);
			}

			if (statement.type === "VariableDeclaration") {
				return isPureConstStatement(
					statement,
					stableLocals,
					checkExpression
				);
			}

			return false;
		};

		const isPureFunctionBody = (
			body: TSESTree.BlockStatement,
			stableLocals: Set<string>,
			checkExpression: (expression: TSESTree.Expression) => boolean
		) => {
			for (const statement of body.body) {
				const statementIsPure = isPureFunctionStatement(
					statement,
					stableLocals,
					checkExpression
				);
				if (!statementIsPure) {
					return false;
				}
			}

			return true;
		};

		const isPureTopLevelFunction = (
			functionNode:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
		) => {
			const cached = pureFunctionCache.get(functionNode);
			if (cached !== undefined) {
				return cached;
			}

			if (pureFunctionInProgress.has(functionNode)) {
				return false;
			}

			pureFunctionInProgress.add(functionNode);

			const stableLocals = new Set<string>();
			addFunctionParamBindings(functionNode, stableLocals);
			const checkExpression = (expression: TSESTree.Expression) =>
				isPureRuntimeExpression(expression, stableLocals);
			const isPure =
				functionNode.body.type === "BlockStatement"
					? isPureFunctionBody(
							functionNode.body,
							stableLocals,
							checkExpression
						)
					: checkExpression(functionNode.body);

			pureFunctionInProgress.delete(functionNode);
			pureFunctionCache.set(functionNode, isPure);
			return isPure;
		};

		const isPureIdentifierCall = (
			callExpression: TSESTree.CallExpression
		) => {
			if (callExpression.callee.type !== "Identifier") {
				return false;
			}

			if (PURE_GLOBAL_FUNCTIONS.has(callExpression.callee.name)) {
				return true;
			}

			const binding = topLevelBindings.get(callExpression.callee.name);
			return binding?.kind === "function"
				? isPureTopLevelFunction(binding.node)
				: false;
		};

		const isPureRuntimeExpression: (
			node: TSESTree.Node | null,
			stableLocals: ReadonlySet<string>
		) => boolean = (node, stableLocals) => {
			if (!node || node.type === "PrivateIdentifier") {
				return false;
			}

			switch (node.type) {
				case "Identifier":
					return isStableIdentifier(node.name, stableLocals);
				case "Literal":
				case "FunctionExpression":
				case "ArrowFunctionExpression":
				case "ClassExpression":
					return true;
				case "ThisExpression":
					return stableLocals.has("this");
				case "TemplateLiteral":
					return node.expressions.every((expression) =>
						isPureRuntimeExpression(expression, stableLocals)
					);
				case "UnaryExpression":
					return isPureRuntimeExpression(node.argument, stableLocals);
				case "BinaryExpression":
				case "LogicalExpression":
					return (
						isPureRuntimeExpression(node.left, stableLocals) &&
						isPureRuntimeExpression(node.right, stableLocals)
					);
				case "ConditionalExpression":
					return (
						isPureRuntimeExpression(node.test, stableLocals) &&
						isPureRuntimeExpression(
							node.consequent,
							stableLocals
						) &&
						isPureRuntimeExpression(node.alternate, stableLocals)
					);
				case "ArrayExpression":
					return node.elements.every((element) => {
						if (!element || element.type === "SpreadElement") {
							return false;
						}

						return isPureRuntimeExpression(element, stableLocals);
					});
				case "ObjectExpression":
					return node.properties.every((property) => {
						if (
							property.type !== "Property" ||
							property.computed ||
							property.kind !== "init"
						) {
							return false;
						}

						if (
							property.key.type !== "Identifier" &&
							property.key.type !== "Literal"
						) {
							return false;
						}

						if (property.method) {
							return true;
						}

						return isPureRuntimeExpression(
							property.value,
							stableLocals
						);
					});
				case "MemberExpression":
					return (
						isPureRuntimeExpression(node.object, stableLocals) &&
						(!node.computed ||
							isPureRuntimeExpression(
								node.property,
								stableLocals
							))
					);
				case "NewExpression":
					return (
						node.callee.type === "Identifier" &&
						PURE_CONSTRUCTORS.has(node.callee.name) &&
						node.arguments.every((argument) => {
							if (argument.type === "SpreadElement") {
								return false;
							}

							return isPureRuntimeExpression(
								argument,
								stableLocals
							);
						})
					);
				case "CallExpression": {
					const argsArePure = node.arguments.every((argument) => {
						if (argument.type === "SpreadElement") {
							return false;
						}

						return isPureRuntimeExpression(argument, stableLocals);
					});

					if (!argsArePure) {
						return false;
					}

					if (node.callee.type === "Identifier") {
						return isPureIdentifierCall(node);
					}

					if (node.callee.type !== "MemberExpression") {
						return false;
					}

					const memberName = getStaticMemberName(node.callee);
					if (!memberName || !PURE_MEMBER_METHODS.has(memberName)) {
						return false;
					}

					return isPureRuntimeExpression(
						node.callee.object,
						stableLocals
					);
				}
				default:
					return false;
			}
		};

		const isSafeJSXAttributeValue = (
			value: TSESTree.JSXAttribute["value"],
			scopeNode: TSESTree.Node
		) => {
			if (value === null) {
				return true;
			}

			if (value.type === "Literal") {
				return true;
			}

			if (value.type !== "JSXExpressionContainer") {
				return false;
			}

			if (value.expression.type === "JSXEmptyExpression") {
				return false;
			}

			return isPureRuntimeExpression(
				value.expression,
				getStableLocalsForNode(scopeNode)
			);
		};

		/**
		 * Determines if a property is a function property.
		 */
		const isFunctionProperty = (prop: TSESTree.Property) => {
			const { value } = prop;
			return (
				Boolean(value) &&
				(value.type === "FunctionExpression" ||
					value.type === "ArrowFunctionExpression" ||
					prop.method === true)
			);
		};

		/**
		 * Safely extracts a key name from a Property that we already know
		 * only uses Identifier or Literal keys in the fixer.
		 */
		const getPropertyKeyName = (prop: TSESTree.Property) => {
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
		};

		/**
		 * Get leading comments for a property, excluding any comments that
		 * are on the same line as the previous property (those are trailing
		 * comments of the previous property).
		 */
		const getLeadingComments = (
			prop: TSESTree.Property,
			prevProp: TSESTree.Property | null
		) => {
			const comments = sourceCode.getCommentsBefore(prop);
			if (!prevProp || comments.length === 0) {
				return comments;
			}
			// Filter out comments on the same line as the previous property
			return comments.filter(
				(comment) => comment.loc.start.line !== prevProp.loc.end.line
			);
		};

		/**
		 * Get trailing comments for a property that are on the same line.
		 * This includes both getCommentsAfter AND any getCommentsBefore of the
		 * next property that are on the same line as this property.
		 */
		const getTrailingComments = (
			prop: TSESTree.Property,
			nextProp: TSESTree.Property | null
		) => {
			const after = sourceCode
				.getCommentsAfter(prop)
				.filter(
					(comment) => comment.loc.start.line === prop.loc.end.line
				);
			if (!nextProp) {
				return after;
			}

			const beforeNext = sourceCode.getCommentsBefore(nextProp);
			const trailingOfPrev = beforeNext.filter(
				(comment) => comment.loc.start.line === prop.loc.end.line
			);
			// Merge, avoiding duplicates
			const newComments = trailingOfPrev.filter(
				(comment) =>
					!after.some(
						(existing) => existing.range[0] === comment.range[0]
					)
			);
			after.push(...newComments);
			return after;
		};

		const getChunkStart = (
			idx: number,
			fixableProps: TSESTree.Property[],
			rangeStart: number,
			fullStart: number
		) => {
			if (idx === 0) {
				return rangeStart;
			}

			const prevProp = fixableProps[idx - 1]!;
			const currentProp = fixableProps[idx]!;
			const prevTrailing = getTrailingComments(prevProp, currentProp);
			const prevEnd =
				prevTrailing.length > 0
					? prevTrailing[prevTrailing.length - 1]!.range[1]
					: prevProp.range[1];
			// Find the comma after the previous property/comments
			const allTokens = sourceCode.getTokensBetween(
				prevProp,
				currentProp,
				{
					includeComments: false
				}
			);
			const tokenAfterPrev =
				allTokens.find((tok) => tok.range[0] >= prevEnd) ?? null;
			if (
				tokenAfterPrev &&
				tokenAfterPrev.value === "," &&
				tokenAfterPrev.range[1] <= fullStart
			) {
				return tokenAfterPrev.range[1];
			}
			return prevEnd;
		};

		/**
		 * Build the sorted text from the fixable properties while preserving
		 * comments and formatting.
		 */
		const buildSortedText = (
			fixableProps: TSESTree.Property[],
			rangeStart: number
		) => {
			// For each property, capture its "chunk": the property text plus
			// its associated comments (leading comments on separate lines,
			// trailing comments on the same line).
			const chunks: {
				prop: TSESTree.Property;
				text: string;
			}[] = [];

			for (let idx = 0; idx < fixableProps.length; idx++) {
				const prop = fixableProps[idx]!;
				const prevProp = idx > 0 ? fixableProps[idx - 1]! : null;
				const nextProp =
					idx < fixableProps.length - 1
						? fixableProps[idx + 1]!
						: null;

				const leading = getLeadingComments(prop, prevProp);
				const trailing = getTrailingComments(prop, nextProp);

				const fullStart =
					leading.length > 0 ? leading[0]!.range[0] : prop.range[0];
				const fullEnd =
					trailing.length > 0
						? trailing[trailing.length - 1]!.range[1]
						: prop.range[1];

				const chunkStart = getChunkStart(
					idx,
					fixableProps,
					rangeStart,
					fullStart
				);

				const text = sourceCode.text.slice(chunkStart, fullEnd);
				chunks.push({ prop, text });
			}

			// Sort the chunks
			const sorted = chunks.slice().sort((left, right) => {
				if (variablesBeforeFunctions) {
					const leftIsFunc = isFunctionProperty(left.prop);
					const rightIsFunc = isFunctionProperty(right.prop);
					if (leftIsFunc !== rightIsFunc) {
						return leftIsFunc ? 1 : SORT_BEFORE;
					}
				}

				const leftKey = getPropertyKeyName(left.prop);
				const rightKey = getPropertyKeyName(right.prop);

				let res = compareKeys(leftKey, rightKey);
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
				.map((chunk, idx) => {
					if (idx === 0) {
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
		};

		const getFixableProps = (node: TSESTree.ObjectExpression) =>
			node.properties.filter(
				(prop): prop is TSESTree.Property =>
					prop.type === "Property" &&
					!prop.computed &&
					(prop.key.type === "Identifier" ||
						prop.key.type === "Literal")
			);

		/**
		 * Checks an ObjectExpression node for unsorted keys.
		 * Reports an error on each out-of-order key.
		 *
		 * For auto-fix purposes, only simple properties are considered fixable.
		 * (Computed keys, spread elements, or non-Identifier/Literal keys disable the fix.)
		 */
		const checkObjectExpression = (node: TSESTree.ObjectExpression) => {
			if (node.properties.length < minKeys) {
				return;
			}

			let autoFixable = true;

			const keys: KeyInfo[] = node.properties.map((prop) => {
				let keyName: string | null = null;
				let isFunc = false;

				if (prop.type !== "Property") {
					autoFixable = false;
					return {
						isFunction: isFunc,
						keyName,
						node: prop
					};
				}

				if (prop.computed) {
					autoFixable = false;
				}

				if (prop.key.type === "Identifier") {
					keyName = prop.key.name;
				} else if (prop.key.type === "Literal") {
					const { value } = prop.key;
					keyName = typeof value === "string" ? value : String(value);
				} else {
					autoFixable = false;
				}

				if (isFunctionProperty(prop)) {
					isFunc = true;
				}

				return {
					isFunction: isFunc,
					keyName,
					node: prop
				};
			});

			if (hasDuplicateNames(keys.map((key) => key.keyName))) {
				autoFixable = false;
			}

			if (
				autoFixable &&
				keys.some(
					(key) =>
						key.node.type === "Property" &&
						!isPureRuntimeExpression(
							key.node.value,
							getStableLocalsForNode(key.node)
						)
				)
			) {
				autoFixable = false;
			}

			let fixProvided = false;

			const createReportWithFix = (curr: KeyInfo, shouldFix: boolean) => {
				context.report({
					fix: shouldFix
						? (fixer) => {
								const fixableProps = getFixableProps(node);
								if (fixableProps.length < minKeys) {
									return null;
								}

								const [firstProp] = fixableProps;
								const lastProp =
									fixableProps[fixableProps.length - 1];

								if (!firstProp || !lastProp) {
									return null;
								}

								const firstLeading = getLeadingComments(
									firstProp,
									null
								);
								const [firstLeadingComment] = firstLeading;
								const rangeStart = firstLeadingComment
									? firstLeadingComment.range[0]
									: firstProp.range[0];
								const lastTrailing = getTrailingComments(
									lastProp,
									null
								);
								const rangeEnd =
									lastTrailing.length > 0
										? lastTrailing[lastTrailing.length - 1]!
												.range[1]
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

			keys.forEach((curr, idx) => {
				if (idx === 0) {
					return;
				}
				const prev = keys[idx - 1];

				if (
					!prev ||
					!curr ||
					prev.keyName === null ||
					curr.keyName === null
				) {
					return;
				}

				const shouldFix = !fixProvided && autoFixable;

				if (
					variablesBeforeFunctions &&
					prev.isFunction &&
					!curr.isFunction
				) {
					createReportWithFix(curr, shouldFix);
					return;
				}

				if (
					variablesBeforeFunctions &&
					prev.isFunction === curr.isFunction &&
					compareKeys(prev.keyName, curr.keyName) > 0
				) {
					createReportWithFix(curr, shouldFix);
					return;
				}

				if (
					!variablesBeforeFunctions &&
					compareKeys(prev.keyName, curr.keyName) > 0
				) {
					createReportWithFix(curr, shouldFix);
				}
			});
		};

		// Also check object literals inside JSX prop expressions
		const checkJSXAttributeObject = (attr: TSESTree.JSXAttribute) => {
			const { value } = attr;
			if (
				value &&
				value.type === "JSXExpressionContainer" &&
				value.expression &&
				value.expression.type === "ObjectExpression"
			) {
				checkObjectExpression(value.expression);
			}
		};

		const getAttrName = (
			attr: TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute
		) => {
			if (
				attr.type !== "JSXAttribute" ||
				attr.name.type !== "JSXIdentifier"
			) {
				return "";
			}
			return attr.name.name;
		};

		const compareAttrNames = (nameLeft: string, nameRight: string) => {
			let res = compareKeys(nameLeft, nameRight);
			if (order === "desc") {
				res = -res;
			}
			return res;
		};

		const isOutOfOrder = (names: string[]) =>
			names.some((currName, idx) => {
				if (idx === 0 || !currName) {
					return false;
				}
				const prevName = names[idx - 1];
				return (
					prevName !== undefined &&
					compareAttrNames(prevName, currName) > 0
				);
			});

		// Also sort JSX attributes on elements
		const checkJSXOpeningElement = (node: TSESTree.JSXOpeningElement) => {
			const attrs = node.attributes;
			if (attrs.length < minKeys) {
				return;
			}

			if (attrs.some((attr) => attr.type !== "JSXAttribute")) {
				return;
			}
			if (
				attrs.some(
					(attr) =>
						attr.type === "JSXAttribute" &&
						attr.name.type !== "JSXIdentifier"
				)
			) {
				return;
			}

			const names = attrs.map((attr) => getAttrName(attr));

			if (!isOutOfOrder(names)) {
				return;
			}

			if (hasDuplicateNames(names)) {
				context.report({
					messageId: "unsorted",
					node:
						attrs[0]!.type === "JSXAttribute"
							? attrs[0]!.name
							: attrs[0]!
				});
				return;
			}

			if (
				attrs.some(
					(attr) =>
						attr.type === "JSXAttribute" &&
						!isSafeJSXAttributeValue(attr.value, attr)
				)
			) {
				context.report({
					messageId: "unsorted",
					node:
						attrs[0]!.type === "JSXAttribute"
							? attrs[0]!.name
							: attrs[0]!
				});
				return;
			}

			// Be conservative: only fix if there are no JSX comments/braces between attributes.
			const braceConflict = attrs.find((currAttr, idx) => {
				if (idx === 0) {
					return false;
				}
				const prevAttr = attrs[idx - 1];
				if (!prevAttr) {
					return false;
				}
				const between = sourceCode.text.slice(
					prevAttr.range[1],
					currAttr.range[0]
				);
				return between.includes("{");
			});

			if (braceConflict) {
				context.report({
					messageId: "unsorted",
					node:
						braceConflict.type === "JSXAttribute"
							? braceConflict.name
							: braceConflict
				});
				return;
			}

			const sortedAttrs = attrs
				.slice()
				.sort((left, right) =>
					compareAttrNames(getAttrName(left), getAttrName(right))
				);

			const [firstAttr] = attrs;
			const lastAttr = attrs[attrs.length - 1];

			if (!firstAttr || !lastAttr) {
				return;
			}

			const replacement = sortedAttrs
				.map((attr) => sourceCode.getText(attr))
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
		};

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
