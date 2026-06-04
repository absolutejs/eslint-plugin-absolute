import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";
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
	"JSON",
	"Map",
	"Math",
	"Number",
	"Object",
	"Promise",
	"RegExp",
	"Set",
	"String",
	"Symbol",
	"URL",
	"globalThis",
	"undefined"
]);
const PURE_GLOBAL_FUNCTIONS = new Set([
	"Boolean",
	"Number",
	"String",
	"decodeURI",
	"decodeURIComponent",
	"encodeURI",
	"encodeURIComponent",
	"isFinite",
	"isNaN",
	"parseFloat",
	"parseInt"
]);
// Method names that are side-effect-free on any standard built-in receiver.
// The rule still verifies the receiver and arguments are pure separately, so a
// match here only relaxes the method-call step itself. Names included here
// are common enough on built-ins (String/Number/Date/Array/Object/Math/JSON)
// that an overload with side effects on a non-built-in class would be highly
// unusual; the single-impure relaxation handles the rare miss.
const PURE_MEMBER_METHODS = new Set([
	// universal
	"toString",
	"valueOf",
	// String non-mutating
	"at",
	"charAt",
	"charCodeAt",
	"codePointAt",
	"endsWith",
	"includes",
	"indexOf",
	"lastIndexOf",
	"match",
	"matchAll",
	"normalize",
	"padEnd",
	"padStart",
	"repeat",
	"replace",
	"replaceAll",
	"search",
	"slice",
	"split",
	"startsWith",
	"substr",
	"substring",
	"toLocaleLowerCase",
	"toLocaleUpperCase",
	"toLowerCase",
	"toUpperCase",
	"trim",
	"trimEnd",
	"trimStart",
	// RegExp non-mutating methods
	"exec",
	"test",
	// Number
	"toExponential",
	"toFixed",
	"toPrecision",
	// Number static (Number.isFinite, etc.) — names distinctive enough
	"isInteger",
	"isSafeInteger",
	// Date getters / formatters
	"getDate",
	"getDay",
	"getFullYear",
	"getHours",
	"getMilliseconds",
	"getMinutes",
	"getMonth",
	"getSeconds",
	"getTime",
	"getTimezoneOffset",
	"getUTCDate",
	"getUTCDay",
	"getUTCFullYear",
	"getUTCHours",
	"getUTCMilliseconds",
	"getUTCMinutes",
	"getUTCMonth",
	"getUTCSeconds",
	"toDateString",
	"toISOString",
	"toJSON",
	"toLocaleDateString",
	"toLocaleString",
	"toLocaleTimeString",
	"toTimeString",
	"toUTCString",
	// Math
	"abs",
	"acos",
	"acosh",
	"asin",
	"asinh",
	"atan",
	"atan2",
	"atanh",
	"cbrt",
	"ceil",
	"clz32",
	"cos",
	"cosh",
	"exp",
	"expm1",
	"floor",
	"fround",
	"hypot",
	"log",
	"log10",
	"log1p",
	"log2",
	"max",
	"min",
	"pow",
	"round",
	"sign",
	"sin",
	"sinh",
	"sqrt",
	"tan",
	"tanh",
	"trunc",
	// Object/Array static
	"entries",
	"fromEntries",
	"getOwnPropertyNames",
	"getOwnPropertySymbols",
	"getPrototypeOf",
	"hasOwn",
	"isArray",
	"keys",
	"values",
	// Array non-mutating, non-callback
	"concat",
	"join",
	// Array non-mutating, callback-taking. Caveat: the callback body could
	// have side effects, but the args-purity check requires each arg to
	// itself be pure (a function expression always counts as pure-as-value),
	// so this only ever creates a false positive when the callback is an
	// arrow whose body has hidden side effects we couldn't see — a rare
	// case in practice and one the single-impure relaxation handles.
	"every",
	"filter",
	"find",
	"findIndex",
	"findLast",
	"findLastIndex",
	"flatMap",
	"map",
	"reduce",
	"reduceRight",
	"some",
	"sort", // mutates in-place but returns same array; safe when receiver is fresh
	// JSON
	"parse",
	"stringify"
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

const getStaticPropertyKeyName = (property: TSESTree.Property) => {
	if (property.key.type === "Identifier") return property.key.name;
	if (property.key.type === "Literal") {
		const { value } = property.key;
		return typeof value === "string" ? value : String(value);
	}
	return null;
};

const isAccessorPairOnly = (kinds: ReadonlyArray<"init" | "get" | "set">) =>
	kinds.length === 2 && kinds.includes("get") && kinds.includes("set");

// Object-property duplicate check that knows about accessor pairs. A pair of
// `get x` and `set x` shares a key by design and is not a real duplicate, so
// it should not disable the autofix the way `{ a: 1, a: 2 }` does. Anything
// else (two inits, two gets, init alongside an accessor, etc.) is a real
// duplicate.
const hasDuplicatePropertyNames = (
	properties: ReadonlyArray<TSESTree.Property | TSESTree.SpreadElement>
) => {
	const kindsByName = new Map<string, Array<"init" | "get" | "set">>();

	properties.forEach((property) => {
		if (property.type !== "Property") return;
		const keyName = getStaticPropertyKeyName(property);
		if (keyName === null) return;
		const kinds = kindsByName.get(keyName) ?? [];
		kinds.push(property.kind);
		kindsByName.set(keyName, kinds);
	});

	return [...kindsByName.values()].some(
		(kinds) => kinds.length > 1 && !isAccessorPairOnly(kinds)
	);
};

export const sortKeysFixable = createRule<Options, MessageIds>({
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
			// Unwrap `export const X = ...` / `export function X() {}` /
			// `export default function X() {}` so the inner declaration is
			// processed normally. Without this, every exported top-level
			// binding was invisible to the purity check, which silently
			// poisoned every reference to it elsewhere in the file.
			let inner: TSESTree.Node = statement;
			if (inner.type === "ExportNamedDeclaration" && inner.declaration) {
				inner = inner.declaration;
			} else if (
				inner.type === "ExportDefaultDeclaration" &&
				(inner.declaration.type === "FunctionDeclaration" ||
					inner.declaration.type === "ClassDeclaration")
			) {
				inner = inner.declaration;
			}

			if (inner.type === "ImportDeclaration") {
				addImportBindings(inner);
				return;
			}

			if (inner.type === "FunctionDeclaration" && inner.id) {
				topLevelBindings.set(inner.id.name, {
					kind: "function",
					node: inner
				});
				return;
			}

			if (
				inner.type !== "VariableDeclaration" ||
				inner.kind !== "const"
			) {
				return;
			}

			for (const declaration of inner.declarations) {
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
			const addDeclarationBindings = (
				statement: TSESTree.Statement | TSESTree.ProgramStatement
			) => {
				// Unwrap `export const X = ...` so module-level exports
				// participate. Without this, every exported binding was
				// invisible to the purity check — which silently poisoned
				// every reference to it elsewhere in the file.
				let inner: TSESTree.Node = statement;
				if (
					inner.type === "ExportNamedDeclaration" &&
					inner.declaration
				) {
					inner = inner.declaration;
				}

				// Reading any local binding (const, let, or var) is
				// side-effect-free — there are no getters on bindings. We
				// previously gated this on `kind === "const"`, but that
				// missed `let firstName = body.firstName ?? ""` patterns
				// where the read is still pure even though the variable can
				// be reassigned. Mutating expressions (assignments, ++, etc.)
				// are caught separately via the default impure branch in
				// isPureRuntimeExpression.
				if (inner.type !== "VariableDeclaration") {
					return;
				}

				for (const declaration of inner.declarations) {
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

		// for (const [k, v] of iterable) { ... } — the loop variable
		// declarations are scoped to the loop body but live on the
		// ForOfStatement / ForInStatement / ForStatement node, not in the
		// body's statement list. Without this, references to `k`/`v`
		// inside the body are treated as unstable, which silently disables
		// reordering for any object built inside the loop.
		const addForStatementBindings = (
			ancestor: TSESTree.Node,
			stableLocals: Set<string>
		) => {
			if (
				ancestor.type !== "ForOfStatement" &&
				ancestor.type !== "ForInStatement" &&
				ancestor.type !== "ForStatement"
			) {
				return;
			}

			const left =
				ancestor.type === "ForStatement"
					? ancestor.init
					: ancestor.left;
			if (!left) return;
			if (left.type !== "VariableDeclaration") {
				addBoundIdentifiers(left, stableLocals);
				return;
			}
			left.declarations.forEach((declaration) =>
				addBoundIdentifiers(declaration.id, stableLocals)
			);
		};

		// `try { ... } catch (err) { ... }` — `err` is bound inside the
		// catch block and frequently referenced in property values.
		const addCatchClauseBindings = (
			ancestor: TSESTree.Node,
			stableLocals: Set<string>
		) => {
			if (ancestor.type !== "CatchClause" || !ancestor.param) return;
			addBoundIdentifiers(ancestor.param, stableLocals);
		};

		const getStableLocalsForNode = (node: TSESTree.Node) => {
			const stableLocals = new Set<string>();
			const ancestors = sourceCode.getAncestors(node);

			for (const ancestor of ancestors) {
				addFunctionBindingsForAncestor(ancestor, stableLocals);
				addForStatementBindings(ancestor, stableLocals);
				addCatchClauseBindings(ancestor, stableLocals);
			}

			for (const ancestor of ancestors) {
				addAncestorBindingsForNode(ancestor, node, stableLocals);
			}

			// `this` is a stable receiver for the duration of any single
			// function call (or arrow that closes over one). Property reads
			// on `this` have the same purity profile as reads on any other
			// stable local, so treat ThisExpression as stable everywhere.
			stableLocals.add("this");

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

		const isPureLocalVariableStatement = (
			statement: TSESTree.VariableDeclaration,
			stableLocals: Set<string>
		) => {
			for (const declaration of statement.declarations) {
				// `let x;` (no init) is fine — the binding exists and is
				// readable; reading an undefined slot is not a side effect.
				if (
					declaration.init &&
					!isPureRuntimeExpression(declaration.init, stableLocals)
				) {
					return false;
				}

				// Handle destructuring (`const { x, y } = obj`,
				// `const [a, b] = arr`) — every bound name becomes a
				// stable read in the rest of the body. addBoundIdentifiers
				// handles nested patterns recursively.
				addBoundIdentifiers(declaration.id, stableLocals);
			}

			return true;
		};

		// Assignments to a local binding don't escape — they only mutate
		// state owned by the function itself. Allowing them as
		// statement-level expressions covers the common
		// `let x = …; x = transform(x); … return x;` pattern in helper
		// functions, without compromising safety: a write to a name we
		// haven't seen as a local binding is still rejected.
		const isPureLocalAssignment = (
			expression: TSESTree.Expression,
			stableLocals: Set<string>
		) => {
			if (expression.type !== "AssignmentExpression") return false;
			if (expression.operator !== "=") {
				// `+=`, `*=`, etc. — same logic, but ensure left is local.
			}
			if (expression.left.type !== "Identifier") return false;
			if (!stableLocals.has(expression.left.name)) return false;
			return isPureRuntimeExpression(expression.right, stableLocals);
		};

		const isPureFunctionStatement: (
			statement: TSESTree.Statement,
			stableLocals: Set<string>
		) => boolean = (statement, stableLocals) => {
			if (statement.type === "ReturnStatement") {
				return (
					!statement.argument ||
					isPureRuntimeExpression(statement.argument, stableLocals)
				);
			}

			if (statement.type === "VariableDeclaration") {
				return isPureLocalVariableStatement(statement, stableLocals);
			}

			if (statement.type === "ExpressionStatement") {
				return isPureLocalAssignment(
					statement.expression,
					stableLocals
				);
			}

			if (statement.type === "IfStatement") {
				if (!isPureRuntimeExpression(statement.test, stableLocals)) {
					return false;
				}
				if (
					!isPureFunctionBranch(
						statement.consequent,
						new Set(stableLocals)
					)
				) {
					return false;
				}
				return (
					!statement.alternate ||
					isPureFunctionBranch(
						statement.alternate,
						new Set(stableLocals)
					)
				);
			}

			if (statement.type === "BlockStatement") {
				return isPureFunctionBody(statement, new Set(stableLocals));
			}

			return false;
		};

		const isPureFunctionBranch = (
			statement: TSESTree.Statement,
			stableLocals: Set<string>
		) => {
			if (statement.type === "BlockStatement") {
				return isPureFunctionBody(statement, stableLocals);
			}
			return isPureFunctionStatement(statement, stableLocals);
		};

		const isPureFunctionBody: (
			body: TSESTree.BlockStatement,
			stableLocals: Set<string>
		) => boolean = (body, stableLocals) => {
			for (const statement of body.body) {
				if (!isPureFunctionStatement(statement, stableLocals)) {
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
			const isPure =
				functionNode.body.type === "BlockStatement"
					? isPureFunctionBody(functionNode.body, stableLocals)
					: isPureRuntimeExpression(functionNode.body, stableLocals);

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
				node.elements.forEach((element) =>
					addTsBoundIdentifiers(element, stableLocals)
				);
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
		) => {
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
			// eslint-disable-next-line absolute/no-explicit-return-type
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

			// `let`/`var` declarations and function/class names — reading
			// the binding is side-effect-free regardless of whether the
			// value can later change. Same reasoning for function
			// parameters (including closure params from outer scopes):
			// reading the parameter slot is always pure. This matters for
			// nested-function-as-helper patterns like
			// `const optStr = (key) => record[key]` where `record` is a
			// closure variable of the enclosing function.
			if (
				ts.isVariableDeclaration(declaration) ||
				ts.isFunctionDeclaration(declaration) ||
				ts.isClassDeclaration(declaration) ||
				ts.isParameter(declaration) ||
				ts.isBindingElement(declaration)
			) {
				return true;
			}

			return false;
		};

		const isPureTsLocalAssignment = (
			expression: ts.Expression,
			stableLocals: ReadonlySet<string>
		) => {
			if (!ts.isBinaryExpression(expression)) return false;
			if (!ASSIGNMENT_OPERATOR_KINDS.has(expression.operatorToken.kind))
				return false;
			if (!ts.isIdentifier(expression.left)) return false;
			if (!stableLocals.has(expression.left.text)) return false;
			return isPureTsExpression(expression.right, stableLocals);
		};

		const isPureTsVariableStatement = (
			statement: ts.VariableStatement,
			stableLocals: Set<string>
		) => {
			for (const declaration of statement.declarationList.declarations) {
				if (
					declaration.initializer &&
					!isPureTsExpression(declaration.initializer, stableLocals)
				) {
					return false;
				}
				// Walk binding name (Identifier, ObjectBindingPattern,
				// ArrayBindingPattern) to capture every introduced
				// stable local.
				addTsBoundIdentifiers(declaration.name, stableLocals);
			}
			return true;
		};

		const isPureTsStatement = (
			statement: ts.Statement,
			stableLocals: Set<string>
		) => {
			if (ts.isReturnStatement(statement)) {
				return (
					!statement.expression ||
					isPureTsExpression(statement.expression, stableLocals)
				);
			}
			if (ts.isVariableStatement(statement)) {
				// Accept const, let, and var. Reading any local binding is
				// side-effect-free; reassignment is handled separately via
				// the ExpressionStatement branch.
				return isPureTsVariableStatement(statement, stableLocals);
			}
			if (ts.isExpressionStatement(statement)) {
				return isPureTsLocalAssignment(
					statement.expression,
					stableLocals
				);
			}
			if (ts.isIfStatement(statement)) {
				if (!isPureTsExpression(statement.expression, stableLocals)) {
					return false;
				}
				const branchScope = new Set(stableLocals);
				if (
					!isPureTsStatementOrBlock(
						statement.thenStatement,
						branchScope
					)
				) {
					return false;
				}
				if (
					statement.elseStatement &&
					!isPureTsStatementOrBlock(
						statement.elseStatement,
						new Set(stableLocals)
					)
				) {
					return false;
				}
				return true;
			}
			if (ts.isBlock(statement)) {
				return isPureTsBlock(statement, new Set(stableLocals));
			}
			return false;
		};

		const isPureTsStatementOrBlock = (
			statement: ts.Statement,
			stableLocals: Set<string>
		) => {
			if (ts.isBlock(statement)) {
				return isPureTsBlock(statement, stableLocals);
			}
			return isPureTsStatement(statement, stableLocals);
		};

		const isPureTsBlock = (block: ts.Block, stableLocals: Set<string>) => {
			for (const statement of block.statements) {
				if (!isPureTsStatement(statement, stableLocals)) {
					return false;
				}
			}
			return true;
		};

		const isPureTsFunction = (
			func:
				| ts.ArrowFunction
				| ts.FunctionDeclaration
				| ts.FunctionExpression
			// eslint-disable-next-line absolute/no-explicit-return-type
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
			// eslint-disable-next-line absolute/no-explicit-return-type
		): boolean => {
			const argsArePure = node.arguments.every((argument) => {
				if (ts.isSpreadElement(argument)) {
					return isPureTsExpression(
						argument.expression,
						stableLocals
					);
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

			// Member-method call (`Math.floor(x)`, `Array.isArray(x)`,
			// `str.trim()`, etc.) — if the method name is in our standard
			// non-mutating allowlist and the receiver is pure, the call is
			// pure. Mirrors the JS-AST walker's PURE_MEMBER_METHODS check.
			if (ts.isPropertyAccessExpression(node.expression)) {
				const memberName = node.expression.name.text;
				if (PURE_MEMBER_METHODS.has(memberName)) {
					return isPureTsExpression(
						node.expression.expression,
						stableLocals
					);
				}
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

			// `typeof x` and `void x` are pure if their operand is pure.
			// (`delete` is intentionally not handled — it mutates the
			// target. `await` and `yield` are also excluded.)
			if (ts.isTypeOfExpression(node) || ts.isVoidExpression(node)) {
				return isPureTsExpression(node.expression, stableLocals);
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
					// Spread of a pure expression — see the matching JS-AST
					// branch for the rationale.
					if (ts.isSpreadElement(element)) {
						return isPureTsExpression(
							element.expression,
							stableLocals
						);
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
		) => {
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

		// ─── Encapsulated-mutation detection (typed) ─────────────────────
		// Drizzle / Zod / TypeBox-style chains like
		// `text("name").notNull().default("foo")` are not strictly "pure" —
		// each method may mutate the column-builder receiver — but their
		// effects are *encapsulated*: the builder is freshly allocated by
		// the root factory and never escapes the chain, so any mutation is
		// invisible to the rest of the program. For sort-keys reordering,
		// encapsulated mutation is equivalent to purity, since any two such
		// chains can be swapped without affecting observable state.
		//
		// We can't ask "is this method side-effect-free" without walking
		// the body (and library code lives in `.d.ts` where there is no
		// body). What we *can* check is whether the receiver chain
		// originates from a freshly-allocated value. If yes, then whatever
		// the method does to its receiver stays inside that chain.
		//
		// The probes here are guarded behind `tsChecker` availability — if
		// typed services aren't engaged we fall through to existing logic
		// and behavior is unchanged.

		const isUnionType = (type: ts.Type): type is ts.UnionType =>
			Boolean(type.flags & ts.TypeFlags.Union);

		// Is this TS type "object-like" for our purposes — a value you'd
		// reasonably consider freshly-allocated and self-contained?
		//   - Class instances, interfaces, anonymous object types          → yes
		//   - Intersections (TypeBox brand types like `T & {kind}`)        → yes
		//   - Unions where every member is object-like or null/undefined   → yes
		//     (covers Angular's `T | null` getters)
		//   - Function-returning factories (`Validators.minLength(1)`)     → yes
		//     (constructing a fresh closure is itself an encapsulated op)
		//   - Primitives, void                                             → no
		const isObjectLikeType = (type: ts.Type): boolean => {
			if (
				type.flags &
				(ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)
			) {
				return false;
			}

			if (isUnionType(type)) {
				return type.types.every((member) => {
					if (
						member.flags &
						(ts.TypeFlags.Null |
							ts.TypeFlags.Undefined |
							ts.TypeFlags.Void)
					) {
						return true;
					}
					return isObjectLikeType(member);
				});
			}

			// Object types — including function and constructor types,
			// since a factory that returns a fresh function (validator,
			// curried fn, event handler) is creating an encapsulated value
			// the same way a factory that returns a class instance is.
			return Boolean(
				type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)
			);
		};

		// Does the call's return type look object-like? Used to distinguish
		// factory-style functions (Drizzle's `text(...)`, TypeBox's
		// `t.Optional(...)`, Angular's `form.get(...)`) from utility
		// functions returning strings/numbers (`errorStatus(...)`,
		// `formatDate(...)`).
		const callReturnsNominalInstance = (node: TSESTree.CallExpression) => {
			if (!tsChecker || !esTreeNodeToTSNodeMap) return false;
			const tsNode = esTreeNodeToTSNodeMap.get(node);
			if (!tsNode) return false;
			const type = tsChecker.getTypeAtLocation(tsNode);
			return isObjectLikeType(type);
		};

		// "Encapsulated-fresh" means the expression evaluates to a value
		// nothing else in the program holds a reference to: a `new`, a
		// factory call returning a class instance, an inline literal, or a
		// method-call chain anchored to such a root. We deliberately do
		// NOT require the method's return type to match the receiver's
		// (Drizzle's brand-typed return values like `NotNull` / `HasDefault`
		// would never satisfy a same-symbol check). We only require that
		// the *receiver* is encapsulated-fresh — that's the property that
		// keeps mutations invisible.
		const isEncapsulatedFreshExpression: (
			node: TSESTree.Node | null,
			stableLocals: ReadonlySet<string>
		) => boolean = (node, stableLocals) => {
			if (!node) return false;

			if (
				node.type === "TSAsExpression" ||
				node.type === "TSTypeAssertion" ||
				node.type === "TSNonNullExpression" ||
				node.type === "TSSatisfiesExpression" ||
				node.type === "TSInstantiationExpression"
			) {
				return isEncapsulatedFreshExpression(
					node.expression,
					stableLocals
				);
			}

			// Inline literals are always fresh.
			if (
				node.type === "ObjectExpression" ||
				node.type === "ArrayExpression"
			) {
				return isPureRuntimeExpression(node, stableLocals);
			}

			// `new C(args)` is always fresh; only need pure args.
			if (node.type === "NewExpression") {
				return node.arguments.every((argument) => {
					if (argument.type === "SpreadElement") {
						return isPureRuntimeExpression(
							argument.argument,
							stableLocals
						);
					}
					return isPureRuntimeExpression(argument, stableLocals);
				});
			}

			if (node.type === "CallExpression") {
				const argsArePure = node.arguments.every((argument) => {
					if (argument.type === "SpreadElement") {
						return isPureRuntimeExpression(
							argument.argument,
							stableLocals
						);
					}
					return isPureRuntimeExpression(argument, stableLocals);
				});
				if (!argsArePure) return false;

				// Method call: any method on an encapsulated-fresh receiver
				// keeps the chain encapsulated. The method may transform
				// the receiver into a brand-typed view (`PgTextBuilder` →
				// `NotNull`) without breaking the freshness property —
				// what matters is no other code holds a reference to the
				// underlying object.
				if (node.callee.type === "MemberExpression") {
					return isEncapsulatedFreshExpression(
						node.callee.object,
						stableLocals
					);
				}

				// Free function: factory if return type is a class/interface
				// instance. We accept any free identifier callee here (not
				// just allowlisted ones), since the type signal is
				// sufficient: a function declared to return a nominal class
				// in a real-world TS codebase is virtually always a factory.
				if (node.callee.type === "Identifier") {
					return callReturnsNominalInstance(node);
				}
			}

			return false;
		};

		const isPureRuntimeExpression: (
			node: TSESTree.Node | null,
			stableLocals: ReadonlySet<string>
		) => boolean = (node, stableLocals) => {
			if (!node || node.type === "PrivateIdentifier") {
				return false;
			}

			// TypeScript expression wrappers are erased at runtime — the
			// wrapped expression is what actually executes. Mirrors the
			// equivalent unwrap branch in isPureTsExpression so the JS-AST
			// walker doesn't conservatively flag `"x" as const`, `x!`, etc.
			// as impure.
			if (
				node.type === "TSAsExpression" ||
				node.type === "TSTypeAssertion" ||
				node.type === "TSNonNullExpression" ||
				node.type === "TSSatisfiesExpression" ||
				node.type === "TSInstantiationExpression"
			) {
				return isPureRuntimeExpression(node.expression, stableLocals);
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
						if (!element) {
							return false;
						}

						// Spread inside an array literal (`[...x]`) is safe as
						// long as the spread argument is itself a pure
						// expression — the iterator on the resulting array is
						// the standard one for built-ins, and any side effects
						// from a custom iterator would be confined to the
						// fresh array we're constructing here. Common cases:
						// `[...STABLE_CONST]`, `[...(arr ?? [])]`,
						// `[...someParam]`.
						if (element.type === "SpreadElement") {
							return isPureRuntimeExpression(
								element.argument,
								stableLocals
							);
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
				case "NewExpression": {
					// Args must be pure (a side-effecting argument
					// expression breaks reorderability regardless of the
					// constructor).
					const argsArePure = node.arguments.every((argument) => {
						if (argument.type === "SpreadElement") {
							return isPureRuntimeExpression(
								argument.argument,
								stableLocals
							);
						}
						return isPureRuntimeExpression(argument, stableLocals);
					});
					if (!argsArePure) return false;

					// Built-in pure constructors (Date) — pure value, not
					// just encapsulated.
					if (
						node.callee.type === "Identifier" &&
						PURE_CONSTRUCTORS.has(node.callee.name)
					) {
						return true;
					}

					// Any other constructor with pure args creates a fresh
					// instance: whatever side effects the constructor does
					// to the new object are encapsulated by definition (the
					// caller is the only thing that holds the reference).
					// This covers `new FormControl("", [validators])`,
					// `new Map()`, `new Set([1,2,3])`, user-defined classes
					// in factory positions, etc.
					return true;
				}
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
						// Factory-style free function (Drizzle's `text(...)`,
						// `uuid(...)`, etc.): the call returns a fresh class
						// instance, so any internal mutation the constructor
						// or factory body performs is invisible elsewhere.
						return (
							isPureIdentifierCall(node) ||
							callReturnsNominalInstance(node)
						);
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

					// Fluent-builder chains (Drizzle-style): if the method's
					// receiver chain roots in a freshly-allocated value, any
					// mutations the method does are invisible elsewhere, so
					// the whole chain is reorderable. See the helper for
					// details on what counts as encapsulated-fresh.
					if (
						isEncapsulatedFreshExpression(
							node.callee.object,
							stableLocals
						)
					) {
						return true;
					}

					// Namespaced factory calls (TypeBox's `t.Object(...)`,
					// `t.String(...)`, etc.): the receiver is a stable
					// namespace import rather than a fresh value, but if the
					// call's return type is a nominal class/interface
					// instance and the receiver is itself pure to read, the
					// call constructs a fresh value with encapsulated
					// effects — same encapsulated-mutation property as
					// Drizzle, just rooted at a namespace member.
					if (
						isPureRuntimeExpression(
							node.callee.object,
							stableLocals
						) &&
						callReturnsNominalInstance(node)
					) {
						return true;
					}

					// Last resort: ask the TS checker whether the property
					// resolves to a function declaration in a source file we
					// can analyze.
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

		// Shared property comparator — the single source of truth for both the
		// "is this segment already sorted?" check and the fixer's reorder, so the
		// fix can never produce output the sortedness check would re-flag.
		const compareProps = (
			left: TSESTree.Property,
			right: TSESTree.Property
		) => {
			if (variablesBeforeFunctions) {
				const leftIsFunc = isFunctionProperty(left);
				const rightIsFunc = isFunctionProperty(right);
				if (leftIsFunc !== rightIsFunc) {
					return leftIsFunc ? 1 : SORT_BEFORE;
				}
			}

			let res = compareKeys(
				getPropertyKeyName(left),
				getPropertyKeyName(right)
			);
			if (order === "desc") {
				res = -res;
			}
			return res;
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
			const sorted = chunks
				.slice()
				.sort((left, right) => compareProps(left.prop, right.prop));

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

			// Spread elements partition the object into independent segments — a
			// segment is a maximal run of consecutive Property nodes. Sorting only
			// ever happens WITHIN a segment, so a key can never cross a spread
			// (which would change which value wins). Each segment is sorted on its
			// own; the spreads stay exactly where they are.
			const segments: TSESTree.Property[][] = [];
			let currentSegment: TSESTree.Property[] = [];
			for (const prop of node.properties) {
				if (prop.type === "Property") {
					currentSegment.push(prop);
					continue;
				}
				if (currentSegment.length > 0) {
					segments.push(currentSegment);
					currentSegment = [];
				}
			}
			if (currentSegment.length > 0) {
				segments.push(currentSegment);
			}

			// Global fix blockers (rare, kept deliberately conservative): a
			// computed key, a non-Identifier/Literal key, or a real duplicate
			// disables the fix for the whole object. Spreads do NOT block — they
			// only segment (handled above).
			let autoFixable = true;

			const keys: KeyInfo[] = node.properties.map((prop) => {
				if (prop.type !== "Property") {
					// SpreadElement — a segment boundary, never a sortable key.
					return { isFunction: false, keyName: null, node: prop };
				}

				if (prop.computed) {
					autoFixable = false;
				}

				let keyName: string | null = null;
				if (prop.key.type === "Identifier") {
					keyName = prop.key.name;
				} else if (prop.key.type === "Literal") {
					const { value } = prop.key;
					keyName = typeof value === "string" ? value : String(value);
				} else {
					autoFixable = false;
				}

				return {
					isFunction: isFunctionProperty(prop),
					keyName,
					node: prop
				};
			});

			if (hasDuplicatePropertyNames(node.properties)) {
				autoFixable = false;
			}

			// Reordering a segment's properties is safe when at most one of its
			// values has side effects: JS evaluates property values in source
			// order, so a single impure value runs exactly once regardless of
			// position. Two or more would have their execution order swapped.
			// Judged PER SEGMENT — a spread pins the values on either side of it,
			// so each segment's evaluation order is independent of the others.
			const isSegmentFixable = (segment: TSESTree.Property[]) =>
				segment.filter(
					(prop) =>
						!isPureRuntimeExpression(
							prop.value,
							getStableLocalsForNode(prop)
						)
				).length <= 1;

			const isSegmentSorted = (segment: TSESTree.Property[]) =>
				segment.every(
					(prop, idx) =>
						idx === 0 || compareProps(segment[idx - 1]!, prop) <= 0
				);

			let fixProvided = false;

			const createReportWithFix = (curr: KeyInfo, shouldFix: boolean) => {
				context.report({
					fix: shouldFix
						? (fixer) => {
								// One replacement per fixable, unsorted segment;
								// segments are non-overlapping (spreads sit
								// between them and are never touched).
								const fixes = segments
									.filter(
										(segment) =>
											segment.length >= minKeys &&
											isSegmentFixable(segment) &&
											!isSegmentSorted(segment)
									)
									.map((segment) => {
										const [firstProp] = segment;
										const lastProp =
											segment[segment.length - 1]!;
										const firstLeading = getLeadingComments(
											firstProp!,
											null
										);
										const [firstLeadingComment] =
											firstLeading;
										const rangeStart = firstLeadingComment
											? firstLeadingComment.range[0]
											: firstProp!.range[0];
										const lastTrailing =
											getTrailingComments(lastProp, null);
										const rangeEnd =
											lastTrailing.length > 0
												? lastTrailing[
														lastTrailing.length - 1
													]!.range[1]
												: lastProp.range[1];

										return fixer.replaceTextRange(
											[rangeStart, rangeEnd],
											buildSortedText(segment, rangeStart)
										);
									});

								return fixes.length > 0 ? fixes : null;
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
	},
	name: "sort-keys-fixable"
});
