import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [
	{
		compositionFiles?: string[];
		routeDirectories?: string[];
	}
];
type MessageIds =
	| "missingRouteContract"
	| "routeContractLocation"
	| "routeSurfaceLocation"
	| "terminalGraphType";

const DEFAULT_ROUTE_DIRECTORIES = [
	"src/backend/routes",
	"src/routes",
	"routes"
];
const DEFAULT_COMPOSITION_FILES = [
	"src/backend/server.ts",
	"src/server.ts",
	"server.ts"
];
const ROUTE_METHODS = new Set([
	"all",
	"connect",
	"delete",
	"get",
	"group",
	"head",
	"mount",
	"options",
	"patch",
	"post",
	"put",
	"route",
	"trace",
	"ws"
]);

type RuleContext = Parameters<
	TSESLint.RuleModule<MessageIds, Options>["create"]
>[0];

const normalizePath = (path: string) =>
	path.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");

const isInsideDirectory = (filename: string, directory: string) => {
	const normalizedFilename = normalizePath(filename);
	const normalizedDirectory = normalizePath(directory);

	return (
		normalizedFilename.startsWith(`${normalizedDirectory}/`) ||
		normalizedFilename.includes(`/${normalizedDirectory}/`)
	);
};

const matchesFile = (filename: string, configuredFile: string) => {
	const normalizedFilename = normalizePath(filename);
	const normalizedConfiguredFile = normalizePath(configuredFile);

	return (
		normalizedFilename === normalizedConfiguredFile ||
		normalizedFilename.endsWith(`/${normalizedConfiguredFile}`)
	);
};

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed)
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: undefined;

	return node.property.type === "Identifier" ? node.property.name : undefined;
};

const callMember = (node: TSESTree.CallExpression) =>
	node.callee.type === "MemberExpression" ? node.callee : undefined;

const chainAnalysis = (expression: TSESTree.Expression) => {
	let current = expression;
	let registersRoute = false;
	let registersHttpPath = false;

	while (current.type === "CallExpression") {
		const member = callMember(current);
		if (!member || member.object.type === "Super") break;
		const method = memberName(member);
		const isRouteMethod = Boolean(method && ROUTE_METHODS.has(method));
		const [firstArgument] = current.arguments;
		registersRoute ||= isRouteMethod;
		registersHttpPath ||=
			isRouteMethod &&
			firstArgument?.type === "Literal" &&
			typeof firstArgument.value === "string" &&
			firstArgument.value.startsWith("/");
		current = member.object;
	}

	return { registersHttpPath, registersRoute, root: current };
};

const variableFor = (context: RuleContext, id: TSESTree.Identifier) => {
	const scope = context.sourceCode.getScope(id);

	return scope.references.find((reference) => reference.identifier === id)
		?.resolved;
};

const blockReturnExpressions = (body: TSESTree.BlockStatement) =>
	body.body.flatMap((statement) =>
		statement.type === "ReturnStatement" && statement.argument
			? [statement.argument]
			: []
	);

const functionReturnExpressions = (
	functionNode:
		| TSESTree.ArrowFunctionExpression
		| TSESTree.FunctionDeclaration
		| TSESTree.FunctionExpression
) =>
	functionNode.body.type === "BlockStatement"
		? blockReturnExpressions(functionNode.body)
		: [functionNode.body];

const definitionExpressions = (definition: TSESLint.Scope.Definition) => {
	if (definition.type === "Variable") {
		const initializer = definition.node.init;
		if (!initializer) return [];
		if (
			initializer.type === "ArrowFunctionExpression" ||
			initializer.type === "FunctionExpression"
		)
			return functionReturnExpressions(initializer);

		return [initializer];
	}
	if (
		definition.type === "FunctionName" &&
		definition.node.type === "FunctionDeclaration"
	)
		return functionReturnExpressions(definition.node);

	return [];
};

const elysiaConstructorLocal = (node: TSESTree.ImportDeclaration) => {
	const specifier = node.specifiers.find(
		(candidate) =>
			candidate.type === "ImportSpecifier" &&
			candidate.imported.type === "Identifier" &&
			candidate.imported.name === "Elysia"
	);

	return specifier?.local.name;
};

const isElysiaExpression = (
	context: RuleContext,
	expression: TSESTree.Expression,
	elysiaConstructors: Set<string>,
	seen = new Set<TSESLint.Scope.Variable>()
): boolean => {
	const { root } = chainAnalysis(expression);
	if (
		root.type === "NewExpression" &&
		root.callee.type === "Identifier" &&
		elysiaConstructors.has(root.callee.name)
	)
		return true;
	if (root.type !== "Identifier") return false;
	const variable = variableFor(context, root);
	if (!variable || seen.has(variable)) return false;
	seen.add(variable);

	return variable.defs.some((definition) =>
		definitionExpressions(definition).some((result) =>
			isElysiaExpression(context, result, elysiaConstructors, seen)
		)
	);
};

const isRouteExpression = (
	context: RuleContext,
	expression: TSESTree.Expression,
	elysiaConstructors: Set<string>
) => {
	const analysis = chainAnalysis(expression);

	return (
		analysis.registersRoute &&
		(analysis.registersHttpPath ||
			isElysiaExpression(context, expression, elysiaConstructors))
	);
};

const declaratorRouteExpressions = (node: TSESTree.VariableDeclarator) => {
	const { init } = node;
	if (!init) return [];
	if (
		init.type === "ArrowFunctionExpression" ||
		init.type === "FunctionExpression"
	)
		return functionReturnExpressions(init);

	return [init];
};

const ancestorTypeAlias = (node: TSESTree.Node) => {
	let current: TSESTree.Node | undefined = node.parent;
	while (current && current.type !== "TSTypeAliasDeclaration")
		current = current.parent;

	return current?.type === "TSTypeAliasDeclaration" ? current : undefined;
};

export const elysiaRouteBoundaries = createRule<Options, MessageIds>({
	create(context, [options]) {
		const compositionFiles =
			options?.compositionFiles ?? DEFAULT_COMPOSITION_FILES;
		const routeDirectories =
			options?.routeDirectories ?? DEFAULT_ROUTE_DIRECTORIES;
		const filename = normalizePath(context.filename);
		const isRouteFile = routeDirectories.some((directory) =>
			isInsideDirectory(filename, directory)
		);
		const isCompositionFile = compositionFiles.some((file) =>
			matchesFile(filename, file)
		);
		const elysiaConstructors = new Set<string>();
		const exportedRouteSymbols = new Map<string, TSESTree.Node>();
		const queriedTypes: Array<{
			alias: TSESTree.TSTypeAliasDeclaration;
			identifier: TSESTree.Identifier;
		}> = [];

		const declaratorIsRoute = (node: TSESTree.VariableDeclarator) =>
			declaratorRouteExpressions(node).some((expression) =>
				isRouteExpression(context, expression, elysiaConstructors)
			);
		const inspectQueriedType = ({
			alias,
			identifier
		}: (typeof queriedTypes)[number]) => {
			const variable = variableFor(context, identifier);
			if (!variable) return;
			const expressions = variable.defs.flatMap(definitionExpressions);
			const referencesRoute = expressions.some((expression) =>
				isRouteExpression(context, expression, elysiaConstructors)
			);
			if (referencesRoute && isCompositionFile) {
				context.report({
					data: { directory: routeDirectories[0] ?? "routes" },
					messageId: "routeContractLocation",
					node: alias
				});
				return;
			}
			if (
				!referencesRoute &&
				expressions.some((expression) =>
					isElysiaExpression(context, expression, elysiaConstructors)
				)
			)
				context.report({
					messageId: "terminalGraphType",
					node: alias
				});
		};

		return {
			ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
				const { declaration } = node;
				if (!declaration) return;
				if (declaration.type === "VariableDeclaration")
					for (const declarator of declaration.declarations)
						if (
							declarator.id.type === "Identifier" &&
							declaratorIsRoute(declarator)
						)
							exportedRouteSymbols.set(
								declarator.id.name,
								declarator
							);
				if (
					declaration.type === "FunctionDeclaration" &&
					declaration.id &&
					functionReturnExpressions(declaration).some((expression) =>
						isRouteExpression(
							context,
							expression,
							elysiaConstructors
						)
					)
				)
					exportedRouteSymbols.set(declaration.id.name, declaration);
			},
			ImportDeclaration(node: TSESTree.ImportDeclaration) {
				if (node.source.value !== "elysia") return;
				const localName = elysiaConstructorLocal(node);
				if (localName) elysiaConstructors.add(localName);
			},
			"Program:exit"() {
				queriedTypes.forEach(inspectQueriedType);

				if (!isRouteFile) return;
				const contractedSymbols = new Set(
					queriedTypes.map(({ identifier }) => identifier.name)
				);
				for (const [symbol, node] of exportedRouteSymbols)
					if (!contractedSymbols.has(symbol))
						context.report({
							data: { symbol },
							messageId: "missingRouteContract",
							node
						});
			},
			TSTypeQuery(node: TSESTree.TSTypeQuery) {
				if (node.exprName.type !== "Identifier") return;
				const alias = ancestorTypeAlias(node);
				if (!alias || alias.parent.type !== "ExportNamedDeclaration")
					return;
				queriedTypes.push({ alias, identifier: node.exprName });
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (!declaratorIsRoute(node) || !isCompositionFile) return;
				context.report({
					data: { directory: routeDirectories[0] ?? "routes" },
					messageId: "routeSurfaceLocation",
					node
				});
			}
		};
	},
	defaultOptions: [
		{
			compositionFiles: DEFAULT_COMPOSITION_FILES,
			routeDirectories: DEFAULT_ROUTE_DIRECTORIES
		}
	],
	meta: {
		docs: {
			description:
				"Detect Elysia route surfaces and inferred contracts semantically, keep them in configured route directories, and prevent terminal graph type exports."
		},
		messages: {
			missingRouteContract:
				"Export an inferred type contract that references `{{symbol}}` so consumers use this isolated route surface instead of the terminal server graph.",
			routeContractLocation:
				"Move this inferred route contract and its route surface under `{{directory}}`; filenames and symbol names are unrestricted.",
			routeSurfaceLocation:
				"Move this route-bearing surface under `{{directory}}`; filenames and symbol names are unrestricted.",
			terminalGraphType:
				"Do not export an inferred type for the terminal composed Elysia graph. Export independently inferred route-surface contracts instead."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					compositionFiles: {
						items: { minLength: 1, type: "string" },
						type: "array"
					},
					routeDirectories: {
						items: { minLength: 1, type: "string" },
						type: "array"
					}
				},
				type: "object"
			}
		],
		type: "problem"
	},
	name: "elysia-route-boundaries"
});
