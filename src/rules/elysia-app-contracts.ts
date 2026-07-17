import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [
	{
		appDirectories?: string[];
	}
];

type MessageIds =
	| "applicationTypeLocation"
	| "missingApplicationFactory"
	| "missingApplicationType"
	| "terminalServerType";

const DEFAULT_APP_DIRECTORIES = ["src/backend/apps", "src/apps", "apps"];
const APP_FILE_PATTERN = /\.app\.[cm]?[jt]sx?$/u;
const APPLICATION_FACTORY_PATTERN = /^create.+Application$/u;
const APPLICATION_TYPE_PATTERN = /Application$/u;

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
