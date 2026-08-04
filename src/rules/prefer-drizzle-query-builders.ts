import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "preferBuilder" | "rawSql";

const SIMPLE_SQL_BUILDERS: ReadonlyArray<[RegExp, string]> = [
	[/^\s*\$\{\}\s*=\s*\$\{\}\s*$/u, "eq"],
	[/^\s*\$\{\}\s*(?:<>|!=)\s*\$\{\}\s*$/u, "ne"],
	[/^\s*\$\{\}\s*>\s*\$\{\}\s*$/u, "gt"],
	[/^\s*\$\{\}\s*>=\s*\$\{\}\s*$/u, "gte"],
	[/^\s*\$\{\}\s*<\s*\$\{\}\s*$/u, "lt"],
	[/^\s*\$\{\}\s*<=\s*\$\{\}\s*$/u, "lte"],
	[/^\s*\$\{\}\s+is\s+null\s*$/iu, "isNull"],
	[/^\s*\$\{\}\s+is\s+not\s+null\s*$/iu, "isNotNull"],
	[/^\s*\$\{\}\s+like\s+\$\{\}\s*$/iu, "like"],
	[/^\s*\$\{\}\s+ilike\s+\$\{\}\s*$/iu, "ilike"],
	[/^\s*\$\{\}\s+in\s*\(\s*\$\{\}\s*\)\s*$/iu, "inArray"],
	[/^\s*\$\{\}\s+not\s+in\s*\(\s*\$\{\}\s*\)\s*$/iu, "notInArray"],
	[/^\s*\$\{\}\s+asc\s*$/iu, "asc"],
	[/^\s*\$\{\}\s+desc\s*$/iu, "desc"]
];

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed) {
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: null;
	}

	return node.property.type === "Identifier" ? node.property.name : null;
};

const templateShape = (node: TSESTree.TemplateLiteral) =>
	node.quasis.map((quasi) => quasi.value.raw).join("${}");

const drizzleSqlLocalName = (specifier: TSESTree.ImportClause) => {
	if (specifier.type !== "ImportSpecifier") return null;
	if (specifier.imported.type !== "Identifier") return null;

	return specifier.imported.name === "sql" ? specifier.local.name : null;
};

export const preferDrizzleQueryBuilders = createRule<Options, MessageIds>({
	create(context) {
		const drizzleSqlLocals = new Set<string>();

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (node.callee.type !== "MemberExpression") return;
				if (memberName(node.callee) !== "raw") return;
				if (
					node.callee.object.type !== "Identifier" ||
					!drizzleSqlLocals.has(node.callee.object.name)
				) {
					return;
				}
				context.report({ messageId: "rawSql", node });
			},
			ImportDeclaration(node: TSESTree.ImportDeclaration) {
				if (node.source.value !== "drizzle-orm") return;
				node.specifiers
					.map(drizzleSqlLocalName)
					.filter((name): name is string => name !== null)
					.forEach((name) => drizzleSqlLocals.add(name));
			},
			TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
				if (
					node.tag.type !== "Identifier" ||
					!drizzleSqlLocals.has(node.tag.name)
				) {
					return;
				}
				const shape = templateShape(node.quasi);
				const match = SIMPLE_SQL_BUILDERS.find(([pattern]) =>
					pattern.test(shape)
				);
				if (!match) return;
				context.report({
					data: { builder: match[1] },
					messageId: "preferBuilder",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require Drizzle's typed query builders for comparisons, null checks, membership, ordering, and patterns that do not need raw SQL."
		},
		messages: {
			preferBuilder:
				"Use Drizzle's typed {{builder}}(...) query builder instead of an sql template for this expression.",
			rawSql: "Do not use sql.raw(); it bypasses Drizzle parameterization and typing. Compose identifiers and values with Drizzle's typed APIs."
		},
		schema: [],
		type: "problem"
	},
	name: "prefer-drizzle-query-builders"
});
