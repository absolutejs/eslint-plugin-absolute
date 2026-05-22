import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";
import * as ts from "typescript";

type Options = [];
type MessageIds = "redundantTypeAnnotation";

// Initializer kinds whose inferred type is independent of any contextual
// annotation on the variable, so it's safe to compare their type against
// the annotation. Excludes literals (which would catch the widening case
// `const x: string = "hello"`), object/array literals (contextually typed),
// function expressions, conditionals, etc.
const ALLOWED_INIT_TYPES: ReadonlySet<string> = new Set([
	"CallExpression",
	"Identifier",
	"MemberExpression",
	"NewExpression",
	"TSAsExpression"
]);

export const noRedundantTypeAnnotation = createRule<Options, MessageIds>({
	create(context) {
		const { sourceCode } = context;
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

		// Without typed services this rule has nothing to compare against.
		if (!tsChecker || !esTreeNodeToTSNodeMap) {
			return {};
		}

		const stringify = (type: ts.Type) =>
			tsChecker.typeToString(
				type,
				undefined,
				ts.TypeFormatFlags.NoTruncation |
					ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
			);

		// Does `typeNode` reference the named type parameter anywhere within it
		// (`S`, `S[]`, `Promise<S>`, `(v) => v is S`, …)?
		const referencesTypeParam = (typeNode: ts.Node, name: string) => {
			let found = false;
			const visit = (node: ts.Node) => {
				if (found) return;
				if (
					ts.isTypeReferenceNode(node) &&
					ts.isIdentifier(node.typeName) &&
					node.typeName.text === name
				) {
					found = true;

					return;
				}
				ts.forEachChild(node, visit);
			};
			visit(typeNode);

			return found;
		};

		// A generic call/new whose result type the variable's annotation can
		// steer via contextual inference. That happens when a type parameter is
		// NOT determined by any argument — it appears in no parameter type — so
		// it's solved from the contextual annotation (or a default). Example:
		// `querySelector<E extends Element = Element>(s: string): E | null`
		// fixes `E` from `const el: HTMLInputElement | null = …`; remove the
		// annotation and `E` falls back to `Element`, changing the type, so the
		// annotation isn't redundant. By contrast a type parameter that appears
		// in a parameter (e.g. `filter<S>(p: (v) => v is S): S[]`) is inferred
		// from the argument, not the annotation, so those stay checkable.
		// Explicit `foo<T>()` type arguments can't be steered at all.
		const leansOnContextualInference = (initNode: ts.Node) => {
			const callLike =
				ts.isCallExpression(initNode) || ts.isNewExpression(initNode)
					? initNode
					: null;
			if (!callLike) return false;
			if (callLike.typeArguments && callLike.typeArguments.length > 0) {
				return false;
			}

			const resolved = tsChecker.getResolvedSignature(callLike);
			const declaration = resolved?.declaration;
			if (declaration && !ts.isJSDocSignature(declaration)) {
				const typeParams = declaration.typeParameters;
				if (!typeParams || typeParams.length === 0) return false;

				return typeParams.some(
					(typeParam) =>
						!declaration.parameters.some(
							(parameter) =>
								parameter.type !== undefined &&
								referencesTypeParam(
									parameter.type,
									typeParam.name.text
								)
						)
				);
			}

			// No analyzable signature declaration — fall back to the
			// conservative check: any generic call signature is steerable.
			const calleeType = tsChecker.getTypeAtLocation(callLike.expression);
			const signatures = ts.isNewExpression(callLike)
				? calleeType.getConstructSignatures()
				: calleeType.getCallSignatures();

			return signatures.some(
				(signature) => (signature.getTypeParameters()?.length ?? 0) > 0
			);
		};

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (node.id.type !== "Identifier") return;
				if (!node.id.typeAnnotation) return;
				if (!node.init) return;
				if (!ALLOWED_INIT_TYPES.has(node.init.type)) return;

				const annotationASTNode = node.id.typeAnnotation.typeAnnotation;
				const annotationTSNode =
					esTreeNodeToTSNodeMap.get(annotationASTNode);
				const initTSNode = esTreeNodeToTSNodeMap.get(node.init);
				if (!annotationTSNode || !initTSNode) return;
				if (!ts.isTypeNode(annotationTSNode)) return;
				if (leansOnContextualInference(initTSNode)) return;

				const annotationType =
					tsChecker.getTypeFromTypeNode(annotationTSNode);
				const initType = tsChecker.getTypeAtLocation(initTSNode);

				// If the annotation references a type alias whose identity
				// the initializer's type doesn't carry (e.g., `type ID = string`
				// annotated on a value whose inferred type is plain `string`),
				// the annotation is doing documentation work — skip.
				const aliasSymbol = ts.isTypeReferenceNode(annotationTSNode)
					? tsChecker.getSymbolAtLocation(annotationTSNode.typeName)
					: undefined;
				if (
					aliasSymbol &&
					aliasSymbol.flags & ts.SymbolFlags.TypeAlias &&
					initType.aliasSymbol !== aliasSymbol
				) {
					return;
				}

				// Skip when typing failed (both `any` is usually a sign the
				// file isn't fully type-checkable, not a real redundancy).
				const bothAny =
					(annotationType.flags & ts.TypeFlags.Any) !== 0 &&
					(initType.flags & ts.TypeFlags.Any) !== 0;
				if (bothAny) return;

				// Different alias symbols mean the named-type is doing
				// documentation work even if the structure is identical
				// (e.g., `type ID = string` vs raw `string`).
				if (annotationType.aliasSymbol !== initType.aliasSymbol) return;

				if (stringify(annotationType) !== stringify(initType)) return;

				const annotationNode = node.id.typeAnnotation;
				context.report({
					fix(fixer) {
						return fixer.removeRange(annotationNode.range);
					},
					messageId: "redundantTypeAnnotation",
					node: annotationNode
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow type annotations on variable declarations whose initializer already has the same inferred type."
		},
		fixable: "code",
		messages: {
			redundantTypeAnnotation:
				"Type annotation is redundant — the initializer already has this type. Remove the annotation and let TypeScript infer it."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-redundant-type-annotation"
});
