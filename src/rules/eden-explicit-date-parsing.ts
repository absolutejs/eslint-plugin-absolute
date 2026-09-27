import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

const EDEN_IMPORTS = new Set([
	"@elysia/eden",
	"@elysia/eden/treaty2",
	"@elysiajs/eden",
	"@elysiajs/eden/treaty"
]);

export const edenExplicitDateParsing = createRule<[], "explicitDateParsing">({
	name: "eden-explicit-date-parsing",
	defaultOptions: [],
	meta: {
		type: "problem",
		docs: {
			description:
				"Require an explicit Eden Treaty date parsing policy; implicit revival changes declared string responses into Date objects."
		},
		schema: [],
		messages: {
			explicitDateParsing:
				"Set parseDate explicitly on this Treaty client. Use false to preserve JSON date strings; use true only when consumers handle revived Date values."
		}
	},
	create(context) {
		return {
			CallExpression(node: TSESTree.CallExpression) {
				const callee = node.callee;
				const identifier =
					callee.type === "Identifier"
						? callee
						: callee.type === "MemberExpression" &&
							  callee.object.type === "Identifier"
							? callee.object
							: null;
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
					const name = callee.property;
					if (
						(name.type === "Identifier" && !callee.computed
							? name.name
							: name.type === "Literal"
								? name.value
								: null) !== "treaty"
					)
						return;
				}
				const options = node.arguments[1];
				// A reusable config can own its policy outside this call. This rule
				// checks inline options, where accidental omission is unambiguous.
				if (options && options.type !== "ObjectExpression") return;
				const policy = options?.properties.findLast(
					(property) =>
						property.type === "SpreadElement" ||
						(property.type === "Property" &&
							(property.key.type === "Identifier" &&
							!property.computed
								? property.key.name
								: property.key.type === "Literal"
									? property.key.value
									: null) === "parseDate")
				);
				if (
					policy?.type === "Property" &&
					policy.value.type === "Literal" &&
					typeof policy.value.value === "boolean"
				)
					return;
				context.report({ node, messageId: "explicitDateParsing" });
			}
		};
	}
});
