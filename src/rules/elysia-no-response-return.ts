import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [{ allowNativeResponsePaths?: string[] }];
type MessageIds = "nativeResponse" | "responseJson";
type FunctionNode =
	| TSESTree.ArrowFunctionExpression
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression;
type FunctionReference = {
	functionNode: FunctionNode;
	target: TSESTree.Node;
};
type ReturnedExpression = (
	context: RuleContext,
	node: TSESTree.Node,
	seen?: Set<TSESLint.Scope.Variable>
) => boolean;
type ResponseUse = {
	functionNode: FunctionNode | undefined;
	kind: "constructor" | "json";
	node: TSESTree.CallExpression | TSESTree.NewExpression;
};

const ROUTE_METHODS = new Set([
	"all",
	"connect",
	"delete",
	"get",
	"head",
	"options",
	"patch",
	"post",
	"put",
	"trace"
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

const routeRegistration = (node: TSESTree.CallExpression) => {
	if (node.callee.type !== "MemberExpression") return undefined;
	const method = memberName(node.callee);
	if (!method) return undefined;
	const pathIndex = method === "route" ? 1 : 0;
	const handlerIndex = method === "route" ? 2 : 1;
	if (method !== "route" && !ROUTE_METHODS.has(method)) return undefined;
	const path = node.arguments[pathIndex];
	const handler = node.arguments[handlerIndex];
	if (
		path?.type !== "Literal" ||
		typeof path.value !== "string" ||
		!path.value.startsWith("/") ||
		!handler ||
		handler.type === "SpreadElement"
	)
		return undefined;

	return { handler, path: path.value };
};

const isResponseJson = (node: TSESTree.CallExpression) =>
	node.callee.type === "MemberExpression" &&
	node.callee.object.type === "Identifier" &&
	node.callee.object.name === "Response" &&
	memberName(node.callee) === "json";

const isResponseConstructor = (node: TSESTree.NewExpression) =>
	node.callee.type === "Identifier" && node.callee.name === "Response";

const preservesReturnedValue = (
	parent: TSESTree.Node,
	current: TSESTree.Node
) => {
	if (parent.type === "ConditionalExpression")
		return parent.consequent === current || parent.alternate === current;
	if (parent.type === "SequenceExpression")
		return parent.expressions[parent.expressions.length - 1] === current;

	return (
		parent.type === "AwaitExpression" ||
		parent.type === "ChainExpression" ||
		parent.type === "LogicalExpression" ||
		parent.type === "TSAsExpression" ||
		parent.type === "TSNonNullExpression" ||
		parent.type === "TSTypeAssertion"
	);
};

const isReturnedVariable = (
	context: RuleContext,
	declarator: TSESTree.VariableDeclarator,
	owner: FunctionNode | undefined,
	seen: Set<TSESLint.Scope.Variable>
) => {
	const [variable] = context.sourceCode.getDeclaredVariables(declarator);
	if (!variable || seen.has(variable)) return false;
	seen.add(variable);

	return variable.references.some(
		(reference) =>
			functionAncestor(reference.identifier) === owner &&
			isReturnedExpression(context, reference.identifier, seen)
	);
};

const isReturnedExpression: ReturnedExpression = (
	context: RuleContext,
	node: TSESTree.Node,
	seen = new Set<TSESLint.Scope.Variable>()
) => {
	const owner = functionAncestor(node);
	let current = node;
	while (current.parent) {
		const { parent } = current;
		if (parent.type === "ReturnStatement")
			return parent.argument === current;
		if (
			parent.type === "ArrowFunctionExpression" &&
			parent.body !== null &&
			parent.body.type !== "BlockStatement"
		)
			return parent.body === current;
		if (parent.type === "VariableDeclarator" && parent.init === current)
			return isReturnedVariable(context, parent, owner, seen);
		if (!preservesReturnedValue(parent, current)) return false;
		current = parent;
	}

	return false;
};

const propagateRoutePaths = (
	context: RuleContext,
	routePaths: Map<FunctionNode, Set<string>>,
	functionReferences: FunctionReference[]
) => {
	const visit = (
		functionNode: FunctionNode,
		path: string,
		visited: Set<FunctionNode>
	) => {
		if (visited.has(functionNode)) return;
		visited.add(functionNode);
		const paths = routePaths.get(functionNode) ?? new Set();
		paths.add(path);
		routePaths.set(functionNode, paths);
		functionReferences
			.filter((reference) => reference.functionNode === functionNode)
			.map(({ target }) => resolveFunction(context, target))
			.filter((target) => target !== undefined)
			.forEach((target) => visit(target, path, visited));
	};
	const roots = [...routePaths.entries()];
	roots.forEach(([functionNode, paths]) =>
		paths.forEach((path) => visit(functionNode, path, new Set()))
	);
};

export const elysiaNoResponseReturn = createRule<Options, MessageIds>({
	create(context, [options]) {
		const allowedPaths = new Set(options?.allowNativeResponsePaths ?? []);
		const functionReferences: FunctionReference[] = [];
		const responseUses: ResponseUse[] = [];
		const routeRegistrations: Array<{
			handler: TSESTree.Node;
			path: string;
		}> = [];

		return {
			CallExpression(node: TSESTree.CallExpression) {
				const route = routeRegistration(node);
				if (route) routeRegistrations.push(route);
				const owner = functionAncestor(node);
				if (isResponseJson(node) && isReturnedExpression(context, node))
					responseUses.push({
						functionNode: owner,
						kind: "json",
						node
					});
				if (owner && node.callee.type === "Identifier")
					functionReferences.push({
						functionNode: owner,
						target: node.callee
					});
				if (owner)
					node.arguments.forEach((argument) => {
						if (argument.type !== "SpreadElement")
							functionReferences.push({
								functionNode: owner,
								target: argument
							});
					});
			},
			NewExpression(node: TSESTree.NewExpression) {
				if (
					isResponseConstructor(node) &&
					isReturnedExpression(context, node)
				)
					responseUses.push({
						functionNode: functionAncestor(node),
						kind: "constructor",
						node
					});
			},
			"Program:exit"() {
				const routePaths = new Map<FunctionNode, Set<string>>();
				for (const { handler, path } of routeRegistrations) {
					const handlerFunction = resolveFunction(context, handler);
					if (!handlerFunction) continue;
					const paths = routePaths.get(handlerFunction) ?? new Set();
					paths.add(path);
					routePaths.set(handlerFunction, paths);
				}

				propagateRoutePaths(context, routePaths, functionReferences);

				for (const { functionNode, kind, node } of responseUses) {
					if (!functionNode) continue;
					const paths = routePaths.get(functionNode);
					if (!paths) continue;
					if (
						kind === "constructor" &&
						[...paths].every((path) => allowedPaths.has(path))
					)
						continue;
					context.report({
						messageId:
							kind === "json" ? "responseJson" : "nativeResponse",
						node
					});
				}
			}
		};
	},
	defaultOptions: [{ allowNativeResponsePaths: [] }],
	meta: {
		docs: {
			description:
				"Preserve Elysia route inference by rejecting Fetch Response values from application route handlers."
		},
		messages: {
			nativeResponse:
				"Return plain typed data, status(...), or redirect(...) from this Elysia route. Reserve new Response(...) for an explicitly allowlisted streaming, file, or HTML route path.",
			responseJson:
				"Return the typed JSON value directly, or status(...) for an error, so Elysia and Eden preserve the route contract."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowNativeResponsePaths: {
						items: { minLength: 1, type: "string" },
						type: "array"
					}
				},
				type: "object"
			}
		],
		type: "problem"
	},
	name: "elysia-no-response-return"
});
