import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [
	{
		appDirectories?: string[];
	}
];

type MessageIds =
	| "applicationValueLocation"
	| "applicationTypeLocation"
	| "missingApplicationFactory"
	| "missingApplicationType"
	| "terminalServerType";

const DEFAULT_APP_DIRECTORIES = ["src/backend/apps", "src/apps", "apps"];
const APP_FILE_PATTERN = /\.app\.[cm]?[jt]sx?$/u;
const APPLICATION_FACTORY_PATTERN = /^create.+Application$/u;
const APPLICATION_TYPE_PATTERN = /Application$/u;
const ROUTE_METHODS = new Set([
	"all",
	"connect",
	"delete",
	"get",
	"group",
	"head",
	"options",
	"patch",
	"post",
	"put",
	"route",
	"trace",
	"ws"
]);

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

const typeQueryIdentifier = (node: TSESTree.TypeNode) => {
	if (node.type !== "TSTypeQuery") return undefined;

	return node.exprName.type === "Identifier" ? node.exprName.name : undefined;
};

const isApplicationType = (node: TSESTree.TSTypeAliasDeclaration) => {
	if (!APPLICATION_TYPE_PATTERN.test(node.id.name)) return false;
	if (node.typeAnnotation.type === "TSTypeQuery") return true;
	if (
		node.typeAnnotation.type !== "TSTypeReference" ||
		node.typeAnnotation.typeName.type !== "Identifier" ||
		node.typeAnnotation.typeName.name !== "ReturnType"
	)
		return false;

	return node.typeAnnotation.typeArguments?.params.some(
		(parameter) => parameter.type === "TSTypeQuery"
	);
};

const exportedVariableNames = (node: TSESTree.VariableDeclaration) =>
	node.declarations.flatMap((declaration) =>
		declaration.id.type === "Identifier" ? [declaration.id.name] : []
	);

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed)
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: undefined;

	return node.property.type === "Identifier" ? node.property.name : undefined;
};

const registersRoute = (expression: TSESTree.Expression) => {
	let current = expression;

	while (current.type === "CallExpression") {
		if (current.callee.type !== "MemberExpression") return false;
		const method = memberName(current.callee);
		if (method && ROUTE_METHODS.has(method)) return true;
		if (current.callee.object.type === "Super") return false;
		current = current.callee.object;
	}

	return false;
};

export const elysiaAppContracts = createRule<Options, MessageIds>({
	create(context, [options]) {
		const appDirectories =
			options?.appDirectories ?? DEFAULT_APP_DIRECTORIES;
		const filename = normalizePath(context.filename);
		const isAppFile =
			APP_FILE_PATTERN.test(filename) &&
			appDirectories.some((directory) =>
				isInsideDirectory(filename, directory)
			);
		let applicationFactory: TSESTree.Node | undefined;
		let applicationType: TSESTree.Node | undefined;

		return {
			ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
				const { declaration } = node;
				if (!declaration) return;
				if (declaration.type === "TSTypeAliasDeclaration") {
					const queriedIdentifier = typeQueryIdentifier(
						declaration.typeAnnotation
					);
					if (
						declaration.id.name === "Server" &&
						queriedIdentifier === "server"
					)
						context.report({
							messageId: "terminalServerType",
							node: declaration
						});

					if (!isApplicationType(declaration)) return;
					applicationType = declaration;
					if (isAppFile) return;
					context.report({
						data: { directory: appDirectories[0] ?? "apps" },
						messageId: "applicationTypeLocation",
						node: declaration
					});
					return;
				}
				if (declaration.type === "VariableDeclaration") {
					if (
						exportedVariableNames(declaration).some((name) =>
							APPLICATION_FACTORY_PATTERN.test(name)
						)
					)
						applicationFactory = declaration;
					return;
				}
				if (
					declaration.type === "FunctionDeclaration" &&
					declaration.id &&
					APPLICATION_FACTORY_PATTERN.test(declaration.id.name)
				)
					applicationFactory = declaration;
			},
			"Program:exit"(node: TSESTree.Program) {
				if (!isAppFile) return;
				if (!applicationFactory)
					context.report({
						messageId: "missingApplicationFactory",
						node
					});
				if (!applicationType)
					context.report({
						messageId: "missingApplicationType",
						node
					});
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (
					isAppFile ||
					node.id.type !== "Identifier" ||
					!APPLICATION_TYPE_PATTERN.test(node.id.name) ||
					!node.init ||
					!registersRoute(node.init)
				)
					return;
				context.report({
					data: { directory: appDirectories[0] ?? "apps" },
					messageId: "applicationValueLocation",
					node
				});
			}
		};
	},
	defaultOptions: [{ appDirectories: DEFAULT_APP_DIRECTORIES }],
	meta: {
		docs: {
			description:
				"Keep inferred Elysia sub-app contracts in dedicated app modules and prevent terminal `typeof server` aliases from forcing TypeScript to instantiate the complete server graph."
		},
		messages: {
			applicationTypeLocation:
				"Move this inferred Elysia application contract into a `*.app.ts` module under `{{directory}}` and inject its dependencies through a create...Application factory.",
			applicationValueLocation:
				"Move this route-bearing Elysia application into a `*.app.ts` module under `{{directory}}` and expose it through a create...Application factory.",
			missingApplicationFactory:
				"This Elysia app module must export a create...Application factory so the entrypoint only assembles independently inferred route surfaces.",
			missingApplicationType:
				"This Elysia app module must export its ...Application type for isolated Eden consumers.",
			terminalServerType:
				"Do not export `typeof server`: it forces TypeScript consumers to instantiate the entire composed Elysia graph. Export the independently inferred sub-app contracts instead."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					appDirectories: {
						items: { minLength: 1, type: "string" },
						type: "array"
					}
				},
				type: "object"
			}
		],
		type: "problem"
	},
	name: "elysia-app-contracts"
});
