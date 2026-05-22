import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "trivialTypeAlias" | "trivialConstAlias";

/**
 * Type-alias declarations whose RHS is a bare reference with no
 * transformation. Catches `type Tag = TagWithCount` (pure rename) and
 * `type AccountId = string` (branded-primitive-without-the-brand —
 * doesn't nominally distinguish anything at runtime).
 *
 * Anything with transformation passes: generic application (`type Foo
 * = Bar<X>`), union/intersection, type operators (`Pick`, `Partial`,
 * `ReturnType`, `Awaited`), template literals, indexed access.
 */
const isBareTypeReference = (node: TSESTree.TypeNode) => {
	if (node.type === "TSTypeReference") {
		// `Foo<T>` is parameterized — that's a transformation, not a rename.
		return !node.typeArguments || node.typeArguments.params.length === 0;
	}
	switch (node.type) {
		case "TSStringKeyword":
		case "TSNumberKeyword":
		case "TSBooleanKeyword":
		case "TSNullKeyword":
		case "TSUndefinedKeyword":
		case "TSVoidKeyword":
		case "TSAnyKeyword":
		case "TSUnknownKeyword":
		case "TSNeverKeyword":
		case "TSBigIntKeyword":
		case "TSSymbolKeyword":
		case "TSObjectKeyword":
			return true;
		default:
			return false;
	}
};

/**
 * Variable initializers that are pure renames of another binding. A
 * bare `Identifier` initializer (`const x = y`) is the canonical case.
 * `MemberExpression` (`const x = obj.foo`) is excluded because it can
 * carry semantic meaning (caching a property lookup, fixing `this`
 * binding at the call site) that bare-identifier renames don't.
 */
const isBareIdentifierInit = (
	init: TSESTree.Expression
): init is TSESTree.Identifier => init.type === "Identifier";

/**
 * Returns `true` if the given Identifier resolves to a `const`-bound
 * variable. A const source can never be reassigned, so `const x =
 * constSource` is always pure rename. Source kinds that CAN be
 * reassigned (`let`, `var`, function parameters) are skipped here,
 * because `const captured = mutableSource` may be a legitimate
 * save-before-mutation capture (e.g., `const resolve = waiter; waiter
 * = null; resolve(...)`).
 */
const isConstSource = (
	context: Parameters<TSESLint.RuleModule<MessageIds, Options>["create"]>[0],
	id: TSESTree.Identifier
) => {
	const scope = context.sourceCode.getScope(id);
	const variable = scope.references.find(
		(ref) => ref.identifier === id
	)?.resolved;
	if (!variable || variable.defs.length === 0) return false;
	return variable.defs.every((def) => {
		if (def.type !== "Variable") return false;
		const {parent} = def;
		if (!parent || parent.type !== "VariableDeclaration") return false;
		return parent.kind === "const";
	});
};

export const noTrivialAlias = createRule<Options, MessageIds>({
	create(context) {
		return {
			TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
				if (!isBareTypeReference(node.typeAnnotation)) return;
				context.report({
					data: { name: node.id.name },
					messageId: "trivialTypeAlias",
					node
				});
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (node.id.type !== "Identifier") return;
				// A type annotation may be narrowing the inferred type, which
				// is real semantic work. Defer that case to
				// `no-redundant-type-annotation`, which already handles
				// "annotation matches inferred type" vs "annotation narrows"
				// correctly. Once the annotation is gone (whether stripped
				// by that rule's autofix or by hand), the bare `const x = y`
				// will trip this rule on the next pass.
				if (node.id.typeAnnotation) return;
				if (!node.init) return;
				if (!isBareIdentifierInit(node.init)) return;
				if (!isConstSource(context, node.init)) return;
				context.report({
					data: { name: node.id.name },
					messageId: "trivialConstAlias",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow identity aliases that rename a type or value without transforming it — `type X = Y` and `const x = y`. Pick one name and use it everywhere."
		},
		messages: {
			trivialConstAlias:
				"`{{name}}` is a trivial rename of another binding. Use the original at the consumer instead — duplicate aliases drift when one side is updated and the other isn't.",
			trivialTypeAlias:
				"`{{name}}` is a pure rename of another type. Use the original type at the consumer instead — duplicate aliases drift when one side is updated and the other isn't."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-trivial-alias"
});
