import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "independentRouteApp" | "preferUseArray";

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

const memberName = (node: TSESTree.MemberExpression) => {
	if (node.computed) {
		return node.property.type === "Literal" &&
			typeof node.property.value === "string"
			? node.property.value
			: undefined;
	}

	return node.property.type === "Identifier" ? node.property.name : undefined;
};

const callMember = (node: TSESTree.CallExpression) =>
	node.callee.type === "MemberExpression" ? node.callee : undefined;

const chainRoot = (expression: TSESTree.Expression) => {
	let current = expression;
	let registersRoute = false;

	while (current.type === "CallExpression") {
		const member = callMember(current);
		if (!member || member.object.type === "Super") break;
		const method = memberName(member);
		if (method && ROUTE_METHODS.has(method)) registersRoute = true;
		current = member.object;
	}

	return { registersRoute, root: current };
};

const isElysiaConstructor = (
	expression: TSESTree.Expression,
	elysiaConstructors: Set<string>
) =>
	expression.type === "NewExpression" &&
	expression.callee.type === "Identifier" &&
	elysiaConstructors.has(expression.callee.name);

const variableFor = (
	context: Parameters<TSESLint.RuleModule<MessageIds, Options>["create"]>[0],
	id: TSESTree.Identifier
) => {
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

const factoryReturnExpressions = (definition: TSESLint.Scope.Definition) => {
	if (definition.type !== "Variable") return [];
	const initializer = definition.node.init;
	if (
		initializer?.type !== "ArrowFunctionExpression" &&
		initializer?.type !== "FunctionExpression"
	)
		return [];

	return initializer.body.type === "BlockStatement"
		? blockReturnExpressions(initializer.body)
		: [initializer.body];
};

const isElysiaApplication = (
	context: Parameters<TSESLint.RuleModule<MessageIds, Options>["create"]>[0],
	expression: TSESTree.Expression,
	elysiaConstructors: Set<string>,
	seen = new Set<TSESLint.Scope.Variable>()
): boolean => {
	const { root } = chainRoot(expression);
	if (isElysiaConstructor(root, elysiaConstructors)) return true;
	if (root.type === "CallExpression" && root.callee.type === "Identifier") {
		const factory = variableFor(context, root.callee);
		if (!factory || seen.has(factory)) return false;
		seen.add(factory);

		return factory.defs.some((definition) =>
			factoryReturnExpressions(definition).some((result) =>
				isElysiaApplication(context, result, elysiaConstructors, seen)
			)
		);
	}
	if (root.type !== "Identifier") return false;
	const variable = variableFor(context, root);
	if (!variable || seen.has(variable)) return false;
	seen.add(variable);

	return variable.defs.some((definition) => {
		if (definition.type !== "Variable") return false;
		const declarator = definition.node;
		if (!declarator.init) return false;

		return isElysiaApplication(
			context,
			declarator.init,
			elysiaConstructors,
			seen
		);
	});
};

const isUseCall = (node: TSESTree.CallExpression) => {
	const member = callMember(node);

	return Boolean(
		member && memberName(member) === "use" && node.arguments.length === 1
	);
};

const parentIsUseCall = (node: TSESTree.CallExpression) => {
	const { parent } = node;
	if (parent.type !== "MemberExpression" || parent.object !== node)
		return false;
	const call = parent.parent;

	return call.type === "CallExpression" && isUseCall(call);
};

const collectUseChain = (node: TSESTree.CallExpression) => {
	const plugins: TSESTree.CallExpressionArgument[] = [];
	let current: TSESTree.Expression = node;

	while (current.type === "CallExpression" && isUseCall(current)) {
		plugins.unshift(current.arguments[0]!);
		const member: TSESTree.MemberExpression = callMember(current)!;
		if (member.object.type === "Super") break;
		current = member.object;
	}

	return { plugins, root: current };
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

export const elysiaCompositionBoundaries = createRule<Options, MessageIds>({
	create(context) {
		const elysiaConstructors = new Set<string>();

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (!isUseCall(node) || parentIsUseCall(node)) return;
				const { plugins, root } = collectUseChain(node);
				if (plugins.length < 2) return;
				const comments = context.sourceCode.getCommentsInside(node);
				context.report({
					fix:
						comments.length === 0
							? (fixer) =>
									fixer.replaceText(
										node,
										`${context.sourceCode.getText(root)}.use([${plugins
											.map((plugin) =>
												context.sourceCode.getText(
													plugin
												)
											)
											.join(", ")}])`
									)
							: undefined,
					messageId: "preferUseArray",
					node
				});
			},
			ImportDeclaration(node: TSESTree.ImportDeclaration) {
				if (node.source.value !== "elysia") return;
				const localName = elysiaConstructorLocal(node);
				if (localName) elysiaConstructors.add(localName);
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (!node.init || node.init.type !== "CallExpression") return;
				const { registersRoute, root } = chainRoot(node.init);
				if (!registersRoute || root.type !== "Identifier") return;
				if (!isElysiaApplication(context, root, elysiaConstructors))
					return;
				context.report({
					data: { source: root.name },
					messageId: "independentRouteApp",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require independent Elysia route applications and prefer shallow array plugin composition so TypeScript does not instantiate an ever-growing server graph."
		},
		fixable: "code",
		messages: {
			independentRouteApp:
				"Build this route surface from a new named Elysia application instead of extending `{{source}}`. Install shared dependencies explicitly, mount both applications at the root, and export the real sub-app type for Eden consumers.",
			preferUseArray:
				"Compose adjacent Elysia plugins with one shallow `.use([pluginA, pluginB])` call to keep the inferred type graph balanced."
		},
		schema: [],
		type: "problem"
	},
	name: "elysia-composition-boundaries"
});
