import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "outsideReactQuery";
type FunctionNode =
	| TSESTree.ArrowFunctionExpression
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression;

const EDEN_HTTP_METHODS = new Set([
	"delete",
	"get",
	"head",
	"options",
	"patch",
	"post",
	"put"
]);
const QUERY_CALLBACK_PROPERTIES = new Set(["mutationFn", "queryFn"]);
const REACT_QUERY_FACTORIES = new Set([
	"infiniteQueryOptions",
	"mutationOptions",
	"queryOptions",
	"useInfiniteQuery",
	"useMutation",
	"useQueries",
	"useQuery",
	"useSuspenseInfiniteQuery",
	"useSuspenseQueries",
	"useSuspenseQuery"
]);

type RuleContext = Parameters<
	TSESLint.RuleModule<MessageIds, Options>["create"]
>[0];

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed)
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: undefined;

	return node.property.type === "Identifier" ? node.property.name : undefined;
};

const propertyName = (node: TSESTree.Property) => {
	if (node.computed) return undefined;
	if (node.key.type === "Identifier") return node.key.name;

	return typeof node.key.value === "string" ? node.key.value : undefined;
};

const expressionContainsApi = (node: TSESTree.Node): boolean => {
	if (node.type === "MemberExpression")
		return memberName(node) === "api" || expressionContainsApi(node.object);
	if (node.type === "CallExpression" || node.type === "NewExpression")
		return expressionContainsApi(node.callee);
	if (node.type === "ChainExpression")
		return expressionContainsApi(node.expression);
	if (
		node.type === "TSAsExpression" ||
		node.type === "TSInstantiationExpression" ||
		node.type === "TSNonNullExpression" ||
		node.type === "TSTypeAssertion"
	)
		return expressionContainsApi(node.expression);

	return false;
};

const isEdenCall = (node: TSESTree.CallExpression) => {
	if (node.callee.type !== "MemberExpression") return false;
	const method = memberName(node.callee);

	return Boolean(
		method &&
		EDEN_HTTP_METHODS.has(method) &&
		expressionContainsApi(node.callee.object)
	);
};

const functionAncestor = (node: TSESTree.Node) => {
	let current = node.parent;
	while (current) {
		if (
			current.type === "ArrowFunctionExpression" ||
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression"
		)
			return current;
		current = current.parent;
	}

	return undefined;
};

const variableFor = (context: RuleContext, identifier: TSESTree.Identifier) =>
	context.sourceCode
		.getScope(identifier)
		.references.find((reference) => reference.identifier === identifier)
		?.resolved;

const functionFromDefinition = (definition: TSESLint.Scope.Definition) => {
	if (
		definition.type === "FunctionName" &&
		definition.node.type === "FunctionDeclaration"
	)
		return definition.node;
	if (definition.type !== "Variable") return undefined;
	const initializer = definition.node.init;

	return initializer?.type === "ArrowFunctionExpression" ||
		initializer?.type === "FunctionExpression"
		? initializer
		: undefined;
};

const resolveFunction = (context: RuleContext, node: TSESTree.Node) => {
	if (
		node.type === "ArrowFunctionExpression" ||
		node.type === "FunctionExpression"
	)
		return node;
	if (node.type !== "Identifier") return undefined;
	const variable = variableFor(context, node);

	return variable?.defs.map(functionFromDefinition).find(Boolean);
};

const importedName = (specifier: TSESTree.ImportClause) => {
	if (specifier.type !== "ImportSpecifier") return undefined;

	return specifier.imported.type === "Identifier"
		? specifier.imported.name
		: String(specifier.imported.value);
};

const belongsToReactQueryFactory = (
	node: TSESTree.Node,
	factories: Set<string>
) => {
	let current = node.parent;
	while (current) {
		if (current.type === "CallExpression")
			return (
				current.callee.type === "Identifier" &&
				factories.has(current.callee.name)
			);
		if (
			current.type === "ArrowFunctionExpression" ||
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression"
		)
			return false;
		current = current.parent;
	}

	return false;
};

const isMutationCall = (node: TSESTree.CallExpression) => {
	if (node.callee.type !== "MemberExpression") return false;
	const method = memberName(node.callee);

	return method === "mutate" || method === "mutateAsync";
};

const belongsToMutationVariables = (node: FunctionNode) => {
	let current: TSESTree.Node | undefined = node.parent;
	while (current) {
		if (current.type === "CallExpression") return isMutationCall(current);
		if (
			current.type === "ArrowFunctionExpression" ||
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression"
		)
			return false;
		current = current.parent;
	}

	return false;
};

const propagateApprovedFunctions = (
	context: RuleContext,
	approvedFunctions: Set<FunctionNode>,
	functionCalls: Array<{
		callee: TSESTree.Identifier;
		functionNode: FunctionNode;
	}>
) => {
	const reachable = new Set<FunctionNode>();
	const visit = (functionNode: FunctionNode) => {
		if (reachable.has(functionNode)) return;
		reachable.add(functionNode);
		functionCalls
			.filter((call) => call.functionNode === functionNode)
			.map(({ callee }) => resolveFunction(context, callee))
			.filter((target) => target !== undefined)
			.forEach(visit);
	};
	approvedFunctions.forEach(visit);
	reachable.forEach((functionNode) => approvedFunctions.add(functionNode));
};

export const edenRequiresReactQuery = createRule<Options, MessageIds>({
	create(context) {
		const approvedFunctions = new Set<FunctionNode>();
		const edenCalls: Array<{
			functionNode: FunctionNode | undefined;
			node: TSESTree.CallExpression;
		}> = [];
		const functionCalls: Array<{
			callee: TSESTree.Identifier;
			functionNode: FunctionNode;
		}> = [];
		const queryFactories = new Set<string>();
		const queryProperties: TSESTree.Property[] = [];

		return {
			CallExpression(node: TSESTree.CallExpression) {
				const owner = functionAncestor(node);
				if (isEdenCall(node))
					edenCalls.push({ functionNode: owner, node });
				if (owner && node.callee.type === "Identifier")
					functionCalls.push({
						callee: node.callee,
						functionNode: owner
					});
			},
			ImportDeclaration(node: TSESTree.ImportDeclaration) {
				if (node.source.value !== "@tanstack/react-query") return;
				for (const specifier of node.specifiers) {
					const sourceName = importedName(specifier);
					if (sourceName && REACT_QUERY_FACTORIES.has(sourceName))
						queryFactories.add(specifier.local.name);
				}
			},
			"Program:exit"() {
				for (const property of queryProperties) {
					const callback = resolveFunction(context, property.value);
					if (callback) approvedFunctions.add(callback);
				}
				for (const { functionNode } of edenCalls)
					if (
						functionNode &&
						belongsToMutationVariables(functionNode)
					)
						approvedFunctions.add(functionNode);

				propagateApprovedFunctions(
					context,
					approvedFunctions,
					functionCalls
				);

				for (const { functionNode, node } of edenCalls)
					if (!functionNode || !approvedFunctions.has(functionNode))
						context.report({
							messageId: "outsideReactQuery",
							node
						});
			},
			Property(node: TSESTree.Property) {
				const name = propertyName(node);
				if (
					name &&
					QUERY_CALLBACK_PROPERTIES.has(name) &&
					belongsToReactQueryFactory(node, queryFactories)
				)
					queryProperties.push(node);
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require browser Eden Treaty requests to execute through React Query query and mutation functions."
		},
		messages: {
			outsideReactQuery:
				"Execute this Eden Treaty request through a React Query queryFn or mutationFn so server state, loading, errors, retries, and invalidation share one lifecycle."
		},
		schema: [],
		type: "problem"
	},
	name: "eden-requires-react-query"
});
