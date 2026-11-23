import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

const EDEN_IMPORTS = new Set([
	"@elysia/eden",
	"@elysia/eden/treaty2",
	"@elysiajs/eden",
	"@elysiajs/eden/treaty"
]);

const identifierOf = (callee: TSESTree.CallExpression["callee"]) => {
	if (callee.type === "Identifier") return callee;
	if (
		callee.type === "MemberExpression" &&
		callee.object.type === "Identifier"
	)
		return callee.object;
	return undefined;
};

const keyName = (key: TSESTree.Node, computed: boolean) => {
	if (!computed && key.type === "Identifier") return key.name;
	return key.type === "Literal" ? key.value : undefined;
};

export const edenExplicitDateParsing = createRule<[], "explicitDateParsing">({
	create(context) {
		return {
			CallExpression(node: TSESTree.CallExpression) {
				const { callee } = node;
				const identifier = identifierOf(callee);
				if (!identifier) return;
				const variable = context.sourceCode
					.getScope(identifier)
					.references.find(
						(reference) => reference.identifier === identifier
					)?.resolved;
				const imported = variable?.defs.find(
					(definition) => definition.type === "ImportBinding"
				);
				if (
					!imported ||
					imported.type !== "ImportBinding" ||
					imported.parent.type !== "ImportDeclaration" ||
					!EDEN_IMPORTS.has(String(imported.parent.source.value))
				)
					return;
				if (callee.type === "Identifier") {
					if (imported.node.type !== "ImportSpecifier") return;
					const name = imported.node.imported;
					if (
						(name.type === "Identifier"
							? name.name
							: name.value) !== "treaty"
					)
						return;
				} else {
					if (
						imported.node.type !== "ImportNamespaceSpecifier" ||
						callee.type !== "MemberExpression"
					)
						return;
					if (keyName(callee.property, callee.computed) !== "treaty")
						return;
				}
				const [, options] = node.arguments;
				// A reusable config can own its policy outside this call. This rule
				// checks inline options, where accidental omission is unambiguous.
				if (options && options.type !== "ObjectExpression") return;
				const policy = options?.properties.findLast(
					(property) =>
						property.type === "SpreadElement" ||
						(property.type === "Property" &&
							keyName(property.key, property.computed) ===
								"parseDate")
				);
				if (
					policy?.type === "Property" &&
					policy.value.type === "Literal" &&
					typeof policy.value.value === "boolean"
				)
					return;
				context.report({ messageId: "explicitDateParsing", node });
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require an explicit Eden Treaty date parsing policy; implicit revival changes declared string responses into Date objects."
		},
		messages: {
			explicitDateParsing:
				"Set parseDate explicitly on this Treaty client. Use false to preserve JSON date strings; use true only when consumers handle revived Date values."
		},
		schema: [],
		type: "problem"
	},
	name: "eden-explicit-date-parsing"
});
