import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "noExplicitReturnType";

type AnyFunctionNode =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

export const noExplicitReturnTypes = createRule<Options, MessageIds>({
	create(context) {
		const hasSingleObjectReturn = (body: TSESTree.BlockStatement) => {
			const returnStatements = body.body.filter(
				(stmt) => stmt.type === "ReturnStatement"
			);

			if (returnStatements.length !== 1) {
				return false;
			}

			const [returnStmt] = returnStatements;
			return returnStmt?.argument?.type === "ObjectExpression";
		};

		// The binding name a function is reachable by from inside itself:
		// its own id, or the `const x = ...` it is assigned to.
		const getOwnName = (node: AnyFunctionNode) => {
			if (node.id) return node.id.name;
			const { parent } = node;
			if (
				parent.type === "VariableDeclarator" &&
				parent.id.type === "Identifier"
			) {
				return parent.id.name;
			}

			return undefined;
		};

		const getDeclaringNode = (node: AnyFunctionNode) => {
			if (node.id) return node;
			const { parent } = node;
			if (parent.type === "VariableDeclarator") return parent.parent;

			return node;
		};

		// Collect the names of every type referenced (via TSTypeReference)
		// anywhere inside an AST subtree — e.g. `T`, `T[]`, `Foo<T>`,
		// `keyof T` all surface the identifier `T`.
		const collectTypeReferenceNames = (root: unknown) => {
			const names = new Set<string>();
			const visit = (value: unknown) => {
				if (!value || typeof value !== "object") {
					return;
				}
				if (Array.isArray(value)) {
					value.forEach(visit);

					return;
				}
				const candidate = value as { type?: unknown };
				if (typeof candidate.type !== "string") {
					return;
				}
				const astNode = value as TSESTree.Node;
				if (
					astNode.type === "TSTypeReference" &&
					astNode.typeName.type === "Identifier"
				) {
					names.add(astNode.typeName.name);
				}
				for (const key of Object.keys(astNode)) {
					if (key === "parent") {
						continue;
					}
					visit((astNode as unknown as Record<string, unknown>)[key]);
				}
			};
			visit(root);

			return names;
		};

		// A type parameter used ONLY in the return-type annotation (and
		// nowhere in the parameter list) cannot be inferred — the annotation
		// is the function's contract, e.g. `<T>(value: unknown): T[]` consumed
		// as `asArray<string>(x)`. Stripping it would orphan the type
		// parameter or force a (banned) assertion, so the annotation is
		// required — not stylistic.
		const hasReturnOnlyTypeParameter = (node: AnyFunctionNode) => {
			const declaredTypeParams = node.typeParameters?.params;
			if (!declaredTypeParams || declaredTypeParams.length === 0) {
				return false;
			}

			const returnTypeNames = collectTypeReferenceNames(node.returnType);
			const parameterTypeNames = new Set<string>();
			for (const parameter of node.params) {
				for (const name of collectTypeReferenceNames(parameter)) {
					parameterTypeNames.add(name);
				}
			}

			return declaredTypeParams.some(
				(typeParam) =>
					returnTypeNames.has(typeParam.name.name) &&
					!parameterTypeNames.has(typeParam.name.name)
			);
		};

		// A function that references its own name in its body is recursive.
		// TypeScript cannot infer a return type that depends on the function's
		// own result (TS7023), so the annotation is required — not stylistic.
		const referencesOwnName = (node: AnyFunctionNode) => {
			const ownName = getOwnName(node);
			if (!ownName) return false;

			const variable = context.sourceCode
				.getDeclaredVariables(getDeclaringNode(node))
				.find((candidate) => candidate.name === ownName);
			if (!variable) return false;

			return variable.references.some(
				(reference) =>
					reference.identifier.range[0] >= node.range[0] &&
					reference.identifier.range[1] <= node.range[1]
			);
		};

		return {
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node: AnyFunctionNode
			) {
				const { returnType } = node;
				if (!returnType) {
					return;
				}

				// Allow type predicate annotations for type guards.
				const { typeAnnotation } = returnType;
				if (
					typeAnnotation &&
					typeAnnotation.type === "TSTypePredicate"
				) {
					return;
				}

				// Allow if it's an arrow function that directly returns an object literal.
				if (
					node.type === "ArrowFunctionExpression" &&
					node.expression === true &&
					node.body.type === "ObjectExpression"
				) {
					return;
				}

				// Allow if the function has a block body with a single return statement that returns an object literal.
				if (
					node.body &&
					node.body.type === "BlockStatement" &&
					hasSingleObjectReturn(node.body)
				) {
					return;
				}

				// Allow recursive (self-referential) functions — TypeScript
				// requires an explicit return type when a function's return
				// depends on its own result (TS7023).
				if (referencesOwnName(node)) {
					return;
				}

				// Allow generics whose type parameter only appears in the
				// return type — inference cannot reproduce it, so the
				// annotation is the contract (e.g. `<T>(v: unknown): T[]`).
				if (hasReturnOnlyTypeParameter(node)) {
					return;
				}

				// Otherwise, report an error.
				context.report({
					messageId: "noExplicitReturnType",
					node: returnType
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow explicit return type annotations on functions, except when the annotation is load-bearing: type predicates for type guards, inline object literal returns (e.g., style objects), recursive functions, or generics whose type parameter appears only in the return type."
		},
		messages: {
			noExplicitReturnType:
				"Explicit return types are disallowed; rely on TypeScript's inference instead."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-explicit-return-type"
});
