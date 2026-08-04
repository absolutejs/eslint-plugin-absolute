import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "drizzleType" | "typeboxEscape";

const TYPEBOX_MODULES = new Set(["@sinclair/typebox", "elysia"]);
const TYPEBOX_ESCAPE_METHODS = new Set(["Any", "Unknown", "Unsafe"]);

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed) {
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: null;
	}

	return node.property.type === "Identifier" ? node.property.name : null;
};

const typeboxNamespaceName = (specifier: TSESTree.ImportClause) => {
	if (specifier.type === "ImportNamespaceSpecifier")
		return specifier.local.name;
	if (specifier.type !== "ImportSpecifier") return null;
	if (specifier.imported.type !== "Identifier") return null;
	if (specifier.imported.name !== "Type" && specifier.imported.name !== "t") {
		return null;
	}

	return specifier.local.name;
};

const isNode = (value: unknown): value is TSESTree.Node =>
	typeof value === "object" &&
	value !== null &&
	"type" in value &&
	typeof value.type === "string";

const containsUnboundedType = (
	node: TSESTree.Node,
	seen = new WeakSet<object>()
): boolean => {
	if (seen.has(node)) return false;
	seen.add(node);
	if (node.type === "TSAnyKeyword" || node.type === "TSUnknownKeyword") {
		return true;
	}

	return Object.entries(node).some(([key, value]) => {
		if (key === "parent") return false;
		if (!value || typeof value !== "object") return false;
		if (Array.isArray(value)) {
			return value.some(
				(child) => isNode(child) && containsUnboundedType(child, seen)
			);
		}
		if (isNode(value)) return containsUnboundedType(value, seen);

		return false;
	});
};

export const noUnsafeSchemaTypes = createRule<Options, MessageIds>({
	create(context) {
		const typeboxNamespaces = new Set<string>();

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (node.callee.type !== "MemberExpression") return;
				const method = memberName(node.callee);
				if (
					method &&
					TYPEBOX_ESCAPE_METHODS.has(method) &&
					node.callee.object.type === "Identifier" &&
					typeboxNamespaces.has(node.callee.object.name)
				) {
					context.report({
						data: { method },
						messageId: "typeboxEscape",
						node
					});

					return;
				}

				if (method !== "$type") return;
				const typeArguments = node.typeArguments?.params ?? [];
				if (
					!typeArguments.some((typeArgument) =>
						containsUnboundedType(typeArgument)
					)
				) {
					return;
				}
				context.report({ messageId: "drizzleType", node });
			},
			ImportDeclaration(node: TSESTree.ImportDeclaration) {
				if (
					typeof node.source.value !== "string" ||
					!TYPEBOX_MODULES.has(node.source.value)
				) {
					return;
				}
				node.specifiers
					.map(typeboxNamespaceName)
					.filter((name): name is string => name !== null)
					.forEach((name) => typeboxNamespaces.add(name));
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow TypeBox validation escape hatches and unbounded any/unknown Drizzle $type annotations. Use an exact runtime schema and a bounded inferred JSON column type."
		},
		messages: {
			drizzleType:
				"Drizzle .$type<any/unknown>() only tells TypeScript to trust unvalidated JSON. Use a bounded domain type derived from the runtime schema, and validate untrusted writes before persistence.",
			typeboxEscape:
				"TypeBox {{method}}() disables exact runtime validation. Model the real shape with TypeBox and derive the TypeScript type from that schema."
		},
		schema: [],
		type: "problem"
	},
	name: "no-unsafe-schema-types"
});
