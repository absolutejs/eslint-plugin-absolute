import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";
import * as ts from "typescript";

type Options = [];
type MessageIds =
	| "directColumn"
	| "directArray"
	| "preferBuilder"
	| "rawSql"
	| "unsafeQuery"
	| "unmappedDate";

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

const mapsDriverValue = (node: TSESTree.TaggedTemplateExpression) => {
	const member = node.parent;
	if (member.type !== "MemberExpression" || member.object !== node)
		return false;
	if (memberName(member) !== "mapWith") return false;
	const call = member.parent;

	return call.type === "CallExpression" && call.callee === member;
};

const declaresDateResult = (
	context: TSESLint.RuleContext<MessageIds, Options>,
	node: TSESTree.TaggedTemplateExpression
) => {
	if (node.typeArguments === undefined) return false;

	return /\bDate\b/u.test(context.sourceCode.getText(node.typeArguments));
};

export const preferDrizzleQueryBuilders = createRule<Options, MessageIds>({
	create(context) {
		const drizzleSqlLocals = new Set<string>();
		const parserServices = context.sourceCode.parserServices ?? null;
		const tsProgram =
			parserServices && "program" in parserServices
				? parserServices.program
				: null;
		const tsChecker = tsProgram ? tsProgram.getTypeChecker() : null;
		const esTreeNodeToTSNodeMap =
			parserServices && "esTreeNodeToTSNodeMap" in parserServices
				? parserServices.esTreeNodeToTSNodeMap
				: null;
		const isArrayInterpolation = (node: TSESTree.Expression) => {
			if (node.type === "ArrayExpression") return true;
			if (!tsChecker || !esTreeNodeToTSNodeMap) return false;
			const type = tsChecker.getTypeAtLocation(
				esTreeNodeToTSNodeMap.get(node)
			);
			const isArrayType = (candidate: ts.Type): boolean =>
				candidate.isUnion()
					? candidate.types.some(isArrayType)
					: tsChecker.isArrayType(candidate) ||
						tsChecker.isTupleType(candidate) ||
						candidate.getSymbol()?.getName() === "ReadonlyArray";

			return isArrayType(type);
		};

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (node.callee.type !== "MemberExpression") return;
				const method = memberName(node.callee);
				if (method === "unsafe") {
					context.report({ messageId: "unsafeQuery", node });

					return;
				}
				if (method !== "raw") return;
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
				const directArray = node.quasi.expressions.find((expression) =>
					isArrayInterpolation(expression)
				);
				if (directArray !== undefined) {
					context.report({
						messageId: "directArray",
						node: directArray
					});

					return;
				}
				if (
					shape.trim() === "${}" &&
					node.quasi.expressions[0]?.type === "MemberExpression"
				) {
					context.report({ messageId: "directColumn", node });

					return;
				}
				if (
					declaresDateResult(context, node) &&
					!mapsDriverValue(node)
				) {
					context.report({ messageId: "unmappedDate", node });

					return;
				}
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
			directArray:
				"Do not interpolate an array directly into a Drizzle sql template: Drizzle expands it as a SQL tuple, not one database array value. Use inArray()/sql.join() for a list, or sql.param(value, columnEncoder) for a database array.",
			directColumn:
				"Select the Drizzle column directly. Wrapping a column in sql<T> bypasses its runtime driver decoder while only pretending the result has type T.",
			preferBuilder:
				"Use Drizzle's typed {{builder}}(...) query builder instead of an sql template for this expression.",
			rawSql: "Do not use sql.raw(); it bypasses Drizzle parameterization and typing. Compose identifiers and values with Drizzle's typed APIs.",
			unmappedDate:
				"sql<Date> changes only TypeScript's belief; it does not decode the database value. Use Drizzle's typed max/min builder or append .mapWith(timestampColumn).",
			unsafeQuery:
				"Do not use .unsafe(); generic row annotations only assert a result type and do not apply Drizzle's runtime decoders. Use a typed Drizzle schema and query builder."
		},
		schema: [],
		type: "problem"
	},
	name: "prefer-drizzle-query-builders"
});
