import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import * as ts from "typescript";

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
	pureImports?: string[];
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
const PURE_GLOBAL_IDENTIFIERS = new Set([
	"Array",
	"BigInt",
	"Boolean",
	"Date",
	"Function",
	"Map",
	"Number",
	"Object",
	"Promise",
	"RegExp",
	"Set",
	"String",
	"Symbol",
	"URL",
	"undefined"
]);
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

		// C1 escape hatch: callees whose name (or member-access path like
		// "t.Object") matches an entry in this set are treated as pure.
		// Used for imports we cannot statically analyze (npm packages that
		// only ship .d.ts), or where the user knows a function is pure
		// despite the static checker's conservative answer.
		const pureImports = new Set(
			option && Array.isArray(option.pureImports)
				? option.pureImports
				: []
		);

		// C3: typed-services hook. When the consumer is running with
		// @typescript-eslint/parser + parserOptions.project, we can resolve
		// imported callees back to their declarations and inspect their
		// bodies for purity. Falls back silently when typed services aren't
		// available — in that case the rule behaves as before (every
		// imported call is impure unless allowlisted via pureImports).
		const parserServices = sourceCode.parserServices ?? null;
		const tsProgram =
			parserServices && "program" in parserServices
				? parserServices.program
				: null;
		const tsChecker = tsProgram ? tsProgram.getTypeChecker() : null;
		const esTreeNodeToTSNodeMap =
			parserServices && "esTreeNodeToTSNodeMap" in parserServices
				? parserServices.esTreeNodeToTSNodeMap
				: null;
		const importedCallPurityCache = new Map<ts.Node, boolean>();
		const importedCallPurityInProgress = new Set<ts.Node>();

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
			if (PURE_GLOBAL_IDENTIFIERS.has(name)) {
				return true;
			}

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

		// ─── C3: TS-AST purity walker ────────────────────────────────────
		// Mirrors isPureRuntimeExpression / isPureTopLevelFunction but
		// operates on the TypeScript AST. Used when we resolve an imported
		// callee back to its declaration in another source file — that
		// declaration is a ts.Node (the program already has it parsed), and
		// we want to inspect its body without re-parsing.
		//
		// Anything not handled here falls through to "impure" (conservative).

		const ASSIGNMENT_OPERATOR_KINDS = new Set<ts.SyntaxKind>([
			ts.SyntaxKind.EqualsToken,
			ts.SyntaxKind.PlusEqualsToken,
			ts.SyntaxKind.MinusEqualsToken,
			ts.SyntaxKind.AsteriskEqualsToken,
			ts.SyntaxKind.AsteriskAsteriskEqualsToken,
			ts.SyntaxKind.SlashEqualsToken,
			ts.SyntaxKind.PercentEqualsToken,
			ts.SyntaxKind.AmpersandEqualsToken,
			ts.SyntaxKind.BarEqualsToken,
			ts.SyntaxKind.CaretEqualsToken,
			ts.SyntaxKind.LessThanLessThanEqualsToken,
			ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
			ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
			ts.SyntaxKind.AmpersandAmpersandEqualsToken,
			ts.SyntaxKind.BarBarEqualsToken,
			ts.SyntaxKind.QuestionQuestionEqualsToken
		]);

		const addTsBoundIdentifiers = (
			node: ts.BindingName | ts.BindingElement | ts.OmittedExpression,
			stableLocals: Set<string>
		) => {
			if (node.kind === ts.SyntaxKind.OmittedExpression) {
				return;
			}
			if (ts.isIdentifier(node)) {
				stableLocals.add(node.text);
				return;
			}
			if (ts.isBindingElement(node)) {
				addTsBoundIdentifiers(node.name, stableLocals);
				return;
			}
			if (
				ts.isObjectBindingPattern(node) ||
				ts.isArrayBindingPattern(node)
			) {
				for (const element of node.elements) {
					addTsBoundIdentifiers(element, stableLocals);
				}
			}
		};

		const getCalleeIdentifier = (callee: ts.Expression) => {
			if (ts.isIdentifier(callee)) {
				return callee;
			}
			if (
				ts.isPropertyAccessExpression(callee) &&
				ts.isIdentifier(callee.name)
			) {
				return callee.name;
			}
			return null;
		};

		const getTsCalleePath = (callee: ts.Expression): string | null => {
			if (ts.isParenthesizedExpression(callee)) {
				return getTsCalleePath(callee.expression);
			}
			if (ts.isIdentifier(callee)) {
				return callee.text;
			}
			if (
				ts.isPropertyAccessExpression(callee) &&
				ts.isIdentifier(callee.name)
			) {
				const objectPath = getTsCalleePath(callee.expression);
				return objectPath === null
					? null
					: `${objectPath}.${callee.name.text}`;
			}
			return null;
		};

		const getFunctionLikeFromDeclaration = (
			declaration: ts.Declaration
		):
			| ts.ArrowFunction
			| ts.FunctionDeclaration
			| ts.FunctionExpression
			| null => {
			if (ts.isFunctionDeclaration(declaration)) {
				return declaration;
			}
			if (
				ts.isVariableDeclaration(declaration) &&
				declaration.initializer
			) {
				const init = declaration.initializer;
				if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
					return init;
				}
			}
			return null;
		};

		const isPureTsIdentifier = (
			identifier: ts.Identifier,
			stableLocals: ReadonlySet<string>
		): boolean => {
			const name = identifier.text;
			if (PURE_GLOBAL_IDENTIFIERS.has(name)) {
				return true;
			}
			if (stableLocals.has(name)) {
				return true;
			}
			if (!tsChecker) {
				return false;
			}

			const symbol = tsChecker.getSymbolAtLocation(identifier);
			if (!symbol) {
				return false;
			}

			const target =
				symbol.flags & ts.SymbolFlags.Alias
					? tsChecker.getAliasedSymbol(symbol)
					: symbol;
			const declaration = target.declarations?.[0];
			if (!declaration) {
				return false;
			}
			if (declaration.getSourceFile().isDeclarationFile) {
				return pureImports.has(name);
			}

			if (
				ts.isVariableDeclaration(declaration) &&
				declaration.initializer &&
				declaration.parent &&
				ts.isVariableDeclarationList(declaration.parent) &&
				declaration.parent.flags & ts.NodeFlags.Const
			) {
				return isPureTsExpression(
					declaration.initializer,
					new Set<string>()
				);
			}

			if (
				ts.isFunctionDeclaration(declaration) ||
				ts.isClassDeclaration(declaration)
			) {
				return true;
			}

			return false;
		};

		const isPureTsBlock = (
			block: ts.Block,
			stableLocals: Set<string>
		): boolean => {
			for (const statement of block.statements) {
				if (ts.isReturnStatement(statement)) {
					if (
						statement.expression &&
						!isPureTsExpression(statement.expression, stableLocals)
					) {
						return false;
					}
					continue;
				}
				if (ts.isVariableStatement(statement)) {
					if (
						!(statement.declarationList.flags & ts.NodeFlags.Const)
					) {
						return false;
					}
					for (const declaration of statement.declarationList
						.declarations) {
						if (
							!ts.isIdentifier(declaration.name) ||
							!declaration.initializer
						) {
							return false;
						}
						if (
							!isPureTsExpression(
								declaration.initializer,
								stableLocals
							)
						) {
							return false;
						}
						stableLocals.add(declaration.name.text);
					}
					continue;
				}
				return false;
			}
			return true;
		};

		const isPureTsFunction = (
			func:
				| ts.ArrowFunction
				| ts.FunctionDeclaration
				| ts.FunctionExpression
		): boolean => {
			const cached = importedCallPurityCache.get(func);
			if (cached !== undefined) {
				return cached;
			}
			if (importedCallPurityInProgress.has(func)) {
				return false;
			}
			importedCallPurityInProgress.add(func);

			const stableLocals = new Set<string>();
			for (const parameter of func.parameters) {
				addTsBoundIdentifiers(parameter.name, stableLocals);
			}

			let pure = false;
			if (func.body) {
				pure = ts.isBlock(func.body)
					? isPureTsBlock(func.body, stableLocals)
					: isPureTsExpression(func.body, stableLocals);
			}

			importedCallPurityInProgress.delete(func);
			importedCallPurityCache.set(func, pure);
			return pure;
		};

		const isPureTsCallExpression = (
			node: ts.CallExpression,
			stableLocals: ReadonlySet<string>
		): boolean => {
			const argsArePure = node.arguments.every((argument) => {
				if (ts.isSpreadElement(argument)) {
					return false;
				}
				return isPureTsExpression(argument, stableLocals);
			});
			if (!argsArePure) {
				return false;
			}

			const calleePath = getTsCalleePath(node.expression);
			if (calleePath !== null && pureImports.has(calleePath)) {
				return true;
			}

			const calleeId = getCalleeIdentifier(node.expression);
			if (!calleeId) {
				return false;
			}
			if (PURE_GLOBAL_FUNCTIONS.has(calleeId.text)) {
				return true;
			}
			if (!tsChecker) {
				return false;
			}

			const symbol = tsChecker.getSymbolAtLocation(calleeId);
			if (!symbol) {
				return false;
			}
			const target =
				symbol.flags & ts.SymbolFlags.Alias
					? tsChecker.getAliasedSymbol(symbol)
					: symbol;
			const declaration = target.declarations?.[0];
			if (!declaration) {
				return false;
			}
			if (declaration.getSourceFile().isDeclarationFile) {
				return false;
			}

			const funcNode = getFunctionLikeFromDeclaration(declaration);
			if (!funcNode) {
				return false;
			}

			return isPureTsFunction(funcNode);
		};

		const isPureTsExpression = (
			node: ts.Node | undefined,
			stableLocals: ReadonlySet<string>
		): boolean => {
			if (!node) {
				return false;
			}

			if (
				ts.isParenthesizedExpression(node) ||
				ts.isAsExpression(node) ||
				ts.isTypeAssertionExpression(node) ||
				ts.isNonNullExpression(node) ||
				ts.isSatisfiesExpression(node)
			) {
				return isPureTsExpression(node.expression, stableLocals);
			}

			if (
				ts.isStringLiteral(node) ||
				ts.isNoSubstitutionTemplateLiteral(node) ||
				ts.isNumericLiteral(node) ||
				ts.isBigIntLiteral(node) ||
				node.kind === ts.SyntaxKind.TrueKeyword ||
				node.kind === ts.SyntaxKind.FalseKeyword ||
				node.kind === ts.SyntaxKind.NullKeyword
			) {
				return true;
			}

			if (
				ts.isFunctionExpression(node) ||
				ts.isArrowFunction(node) ||
				ts.isClassExpression(node)
			) {
				return true;
			}

			if (node.kind === ts.SyntaxKind.ThisKeyword) {
				return stableLocals.has("this");
			}

			if (ts.isIdentifier(node)) {
				return isPureTsIdentifier(node, stableLocals);
			}

			if (ts.isTemplateExpression(node)) {
				return node.templateSpans.every((span) =>
					isPureTsExpression(span.expression, stableLocals)
				);
			}

			if (
				ts.isPrefixUnaryExpression(node) ||
				ts.isPostfixUnaryExpression(node)
			) {
				return isPureTsExpression(node.operand, stableLocals);
			}

			if (ts.isBinaryExpression(node)) {
				if (
					ASSIGNMENT_OPERATOR_KINDS.has(node.operatorToken.kind) ||
					node.operatorToken.kind === ts.SyntaxKind.CommaToken
				) {
					return false;
				}
				return (
					isPureTsExpression(node.left, stableLocals) &&
					isPureTsExpression(node.right, stableLocals)
				);
			}

			if (ts.isConditionalExpression(node)) {
				return (
					isPureTsExpression(node.condition, stableLocals) &&
					isPureTsExpression(node.whenTrue, stableLocals) &&
					isPureTsExpression(node.whenFalse, stableLocals)
				);
			}

			if (ts.isArrayLiteralExpression(node)) {
				return node.elements.every((element) => {
					if (ts.isSpreadElement(element)) {
						return false;
					}
					if (element.kind === ts.SyntaxKind.OmittedExpression) {
						return false;
					}
					return isPureTsExpression(element, stableLocals);
				});
			}

			if (ts.isObjectLiteralExpression(node)) {
				return node.properties.every((property) => {
					if (ts.isShorthandPropertyAssignment(property)) {
						return isPureTsIdentifier(property.name, stableLocals);
					}
					if (ts.isPropertyAssignment(property)) {
						if (ts.isComputedPropertyName(property.name)) {
							return false;
						}
						return isPureTsExpression(
							property.initializer,
							stableLocals
						);
					}
					if (ts.isMethodDeclaration(property)) {
						return !ts.isComputedPropertyName(property.name);
					}
					return false;
				});
			}

			if (ts.isPropertyAccessExpression(node)) {
				return isPureTsExpression(node.expression, stableLocals);
			}

			if (ts.isElementAccessExpression(node)) {
				return (
					isPureTsExpression(node.expression, stableLocals) &&
					isPureTsExpression(node.argumentExpression, stableLocals)
				);
			}

			if (ts.isNewExpression(node)) {
				if (
					!ts.isIdentifier(node.expression) ||
					!PURE_CONSTRUCTORS.has(node.expression.text)
				) {
					return false;
				}
				return (
					node.arguments?.every((argument) => {
						if (ts.isSpreadElement(argument)) {
							return false;
						}
						return isPureTsExpression(argument, stableLocals);
					}) ?? true
				);
			}

			if (ts.isCallExpression(node)) {
				return isPureTsCallExpression(node, stableLocals);
			}

			return false;
		};

		// Render a callee like `asset` or `t.Object` to a dotted string for
		// matching against the pureImports allowlist. Returns null if the
		// callee is dynamic (computed access, calls, etc.) and can't be
		// expressed as a simple path.
		const getCalleePath = (node: TSESTree.Node): string | null => {
			if (node.type === "Identifier") {
				return node.name;
			}
			if (node.type === "ChainExpression") {
				return getCalleePath(node.expression);
			}
			if (
				node.type === "MemberExpression" &&
				!node.computed &&
				node.property.type === "Identifier"
			) {
				const objectPath = getCalleePath(node.object);
				return objectPath === null
					? null
					: `${objectPath}.${node.property.name}`;
			}
			return null;
		};

		// Look up the ESTree callee in the TS Program and walk the resolved
		// declaration's body. Returns true when the imported function's body
		// is statically pure; false when typed services are unavailable, the
		// declaration lives in a .d.ts (no body), or the body has side
		// effects we can detect.
		const isPureImportedCallExpression = (
			callExpression: TSESTree.CallExpression
		): boolean => {
			if (!tsChecker || !esTreeNodeToTSNodeMap) {
				return false;
			}

			let calleeEsNode: TSESTree.Node | null = null;
			if (callExpression.callee.type === "Identifier") {
				calleeEsNode = callExpression.callee;
			} else if (
				callExpression.callee.type === "MemberExpression" &&
				!callExpression.callee.computed &&
				callExpression.callee.property.type === "Identifier"
			) {
				calleeEsNode = callExpression.callee.property;
			}
			if (!calleeEsNode) {
				return false;
			}

			const tsCallee = esTreeNodeToTSNodeMap.get(calleeEsNode);
			if (!tsCallee || !ts.isIdentifier(tsCallee)) {
				return false;
			}

			const symbol = tsChecker.getSymbolAtLocation(tsCallee);
			if (!symbol) {
				return false;
			}

			const target =
				symbol.flags & ts.SymbolFlags.Alias
					? tsChecker.getAliasedSymbol(symbol)
					: symbol;
			const declaration = target.declarations?.[0];
			if (!declaration) {
				return false;
			}
			if (declaration.getSourceFile().isDeclarationFile) {
				return false;
			}

			const funcNode = getFunctionLikeFromDeclaration(declaration);
			if (!funcNode) {
				return false;
			}

			return isPureTsFunction(funcNode);
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

			if (pureImports.has(callExpression.callee.name)) {
				return true;
			}

			const binding = topLevelBindings.get(callExpression.callee.name);
			if (binding?.kind === "function") {
				return isPureTopLevelFunction(binding.node);
			}

			// binding is undefined (free name) or "import" — fall back to
			// resolving the symbol via the TS program.
			return isPureImportedCallExpression(callExpression);
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
				case "ChainExpression":
					return isPureRuntimeExpression(
						node.expression,
						stableLocals
					);
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

					const calleePath = getCalleePath(node.callee);
					if (calleePath !== null && pureImports.has(calleePath)) {
						return true;
					}

					if (node.callee.type === "Identifier") {
						return isPureIdentifierCall(node);
					}

					if (node.callee.type !== "MemberExpression") {
						return false;
					}

					const memberName = getStaticMemberName(node.callee);
					if (memberName && PURE_MEMBER_METHODS.has(memberName)) {
						return isPureRuntimeExpression(
							node.callee.object,
							stableLocals
						);
					}

					// Namespaced imports like `t.Object(...)`: ask the TS
					// checker whether the property resolves to a function
					// declaration in a source file we can analyze.
					return isPureImportedCallExpression(node);
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

			// Reordering object literal properties is safe when at most one
			// value has side effects: JS evaluates property values in source
			// order, so if only one value is impure it gets called exactly
			// once regardless of position, and its execution order relative
			// to anything outside the literal is unchanged. Two or more
			// impure values would have their execution order swapped.
			if (autoFixable) {
				const impureCount = keys.filter(
					(key) =>
						key.node.type === "Property" &&
						!isPureRuntimeExpression(
							key.node.value,
							getStableLocalsForNode(key.node)
						)
				).length;

				if (impureCount > 1) {
					autoFixable = false;
				}
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

			// Same reasoning as ObjectExpression: a single impure attribute
			// value reorders safely (it executes once either way), but two or
			// more would swap their relative evaluation order.
			const impureAttrCount = attrs.filter(
				(attr) =>
					attr.type === "JSXAttribute" &&
					!isSafeJSXAttributeValue(attr.value, attr)
			).length;

			if (impureAttrCount > 1) {
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
					pureImports: {
						items: { type: "string" },
						type: "array",
						uniqueItems: true
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
