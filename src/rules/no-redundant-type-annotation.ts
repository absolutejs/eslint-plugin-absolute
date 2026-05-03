import { TSESLint, TSESTree } from "@typescript-eslint/utils";
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

export const noRedundantTypeAnnotation: TSESLint.RuleModule<
	MessageIds,
	Options
> = {
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
	}
};
