import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [{ minProperties?: number }];
type MessageIds = "inlineObjectType";

const DEFAULT_MIN_PROPERTIES = 2;

const toPascalCase = (name: string) => {
	const parts = name.replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean);
	if (parts.length === 0) return name;
	return parts
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
};

const collectInlineObjectTypes = (
	node: TSESTree.TypeNode,
	found: TSESTree.TSTypeLiteral[]
) => {
	if (node.type === "TSTypeLiteral") {
		found.push(node);
		return;
	}
	if (node.type === "TSArrayType") {
		collectInlineObjectTypes(node.elementType, found);
		return;
	}
	if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
		node.types.forEach((member) => collectInlineObjectTypes(member, found));
		return;
	}
	// Descend into generic type arguments — covers Array<T>, Promise<T>,
	// Record<K, V>, Map<K, V>, and user-defined generics.
	if (node.type === "TSTypeReference" && node.typeArguments) {
		node.typeArguments.params.forEach((arg) =>
			collectInlineObjectTypes(arg, found)
		);
	}
};

// Strip wrappers around a parameter binding to find the actual binding target,
// which is where the type annotation and the binding name live.
const unwrapParamTarget = (node: TSESTree.Node) => {
	if (node.type === "TSParameterProperty") {
		return unwrapParamTarget(node.parameter);
	}
	if (node.type === "AssignmentPattern") {
		return unwrapParamTarget(node.left);
	}
	return node;
};

const SCOPE_BOUNDARY_TYPES: ReadonlySet<string> = new Set([
	"ArrowFunctionExpression",
	"ClassDeclaration",
	"ClassExpression",
	"FunctionDeclaration",
	"FunctionExpression"
]);

// For positions that don't carry their own name (call/new generic args),
// walk up the AST to find an enclosing identifier we can borrow.
const deriveNameFromAncestors = (node: TSESTree.Node) => {
	let current: TSESTree.Node | undefined = node.parent;
	while (current) {
		if (
			current.type === "VariableDeclarator" &&
			current.id.type === "Identifier"
		) {
			return toPascalCase(current.id.name);
		}
		if (
			current.type === "PropertyDefinition" &&
			current.key.type === "Identifier"
		) {
			return toPascalCase(current.key.name);
		}
		// Stop at scope boundaries to avoid borrowing names from outer contexts.
		if (SCOPE_BOUNDARY_TYPES.has(current.type)) return "T";
		current = current.parent;
	}
	return "T";
};

export const noInlineObjectTypes = createRule<Options, MessageIds>({
	create(context) {
		const [options] = context.options;
		const minProperties = options?.minProperties ?? DEFAULT_MIN_PROPERTIES;

		const reportAnnotation = (
			typeNode: TSESTree.TypeNode,
			suggestedName: string
		) => {
			const literals: TSESTree.TSTypeLiteral[] = [];
			collectInlineObjectTypes(typeNode, literals);
			for (const literal of literals) {
				if (literal.members.length < minProperties) continue;
				// An index signature alone is `Record<K, V>` territory.
				const hasIndexSignature = literal.members.some(
					(member) => member.type === "TSIndexSignature"
				);
				if (hasIndexSignature) continue;
				context.report({
					data: { suggestedName },
					messageId: "inlineObjectType",
					node: literal
				});
			}
		};

		const handleFunctionParams = (params: TSESTree.Parameter[]) => {
			for (const param of params) {
				const target = unwrapParamTarget(param);
				if (!("typeAnnotation" in target)) continue;
				const annotation = target.typeAnnotation;
				if (!annotation || annotation.type !== "TSTypeAnnotation")
					continue;
				const name =
					target.type === "Identifier"
						? toPascalCase(target.name)
						: "Params";
				reportAnnotation(annotation.typeAnnotation, name);
			}
		};

		return {
			"CallExpression, NewExpression"(
				node: TSESTree.CallExpression | TSESTree.NewExpression
			) {
				if (!node.typeArguments) return;
				const name = deriveNameFromAncestors(node);
				for (const typeArg of node.typeArguments.params) {
					reportAnnotation(typeArg, name);
				}
			},
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node:
					| TSESTree.FunctionDeclaration
					| TSESTree.FunctionExpression
					| TSESTree.ArrowFunctionExpression
			) {
				handleFunctionParams(node.params);
			},
			PropertyDefinition(node: TSESTree.PropertyDefinition) {
				if (
					!node.typeAnnotation ||
					node.typeAnnotation.type !== "TSTypeAnnotation"
				)
					return;
				const name =
					node.key.type === "Identifier"
						? toPascalCase(node.key.name)
						: "Field";
				reportAnnotation(node.typeAnnotation.typeAnnotation, name);
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (node.id.type !== "Identifier") return;
				const annotation = node.id.typeAnnotation;
				if (!annotation || annotation.type !== "TSTypeAnnotation")
					return;
				reportAnnotation(
					annotation.typeAnnotation,
					toPascalCase(node.id.name)
				);
			}
		};
	},
	defaultOptions: [{ minProperties: DEFAULT_MIN_PROPERTIES }],
	meta: {
		docs: {
			description:
				"Disallow inline object type literals on annotations (variables, class fields, function params, generic type arguments); prefer extracting them to a named type alias."
		},
		messages: {
			inlineObjectType:
				"Inline object type should be extracted to a named type alias (e.g., `type {{suggestedName}} = { ... }`)."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					minProperties: {
						minimum: 1,
						type: "number"
					}
				},
				type: "object"
			}
		],
		type: "suggestion"
	},
	name: "no-inline-object-types"
});
