import { AST_NODE_TYPES, TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "nondeterministicField" | "nondeterministicTemplate";

const BANNED_TEMPLATE_PATTERN =
	/\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bcrypto\.randomUUID\s*\(|\bperformance\.now\s*\(/;

const isIdentifier = (node: TSESTree.Node | null | undefined, name: string) =>
	node?.type === AST_NODE_TYPES.Identifier && node.name === name;

const isStaticMemberCall = (
	node: TSESTree.CallExpression,
	objectName: string,
	propertyName: string
) =>
	node.callee.type === AST_NODE_TYPES.MemberExpression &&
	!node.callee.computed &&
	isIdentifier(node.callee.object, objectName) &&
	isIdentifier(node.callee.property, propertyName);

const getPropertyName = (node: TSESTree.Property) => {
	const { key } = node;
	if (key.type === AST_NODE_TYPES.Identifier) return key.name;
	if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
		return key.value;
	}

	return null;
};

const isComponentDecorator = (decorator: TSESTree.Decorator) => {
	const { expression } = decorator;

	return (
		expression.type === AST_NODE_TYPES.CallExpression &&
		isIdentifier(expression.callee, "Component")
	);
};

const isAngularComponentClass = (node: TSESTree.Node) =>
	node.type === AST_NODE_TYPES.ClassDeclaration &&
	(node.decorators ?? []).some(isComponentDecorator);

const getTemplateText = (node: TSESTree.Node) => {
	if (
		node.type === AST_NODE_TYPES.Literal &&
		typeof node.value === "string"
	) {
		return node.value;
	}
	if (node.type === AST_NODE_TYPES.TemplateLiteral) {
		return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
	}

	return null;
};

const getEnclosingAngularComponentClass = (node: TSESTree.Node) => {
	let current: TSESTree.Node | undefined = node.parent;
	while (current) {
		if (isAngularComponentClass(current)) return current;
		current = current.parent;
	}

	return null;
};

const getEnclosingPropertyDefinition = (node: TSESTree.Node) => {
	let current: TSESTree.Node | undefined = node.parent;
	while (current) {
		if (current.type === AST_NODE_TYPES.PropertyDefinition) {
			return current;
		}
		if (
			current.type === AST_NODE_TYPES.MethodDefinition ||
			current.type === AST_NODE_TYPES.FunctionDeclaration ||
			current.type === AST_NODE_TYPES.FunctionExpression ||
			current.type === AST_NODE_TYPES.ArrowFunctionExpression
		) {
			return null;
		}
		current = current.parent;
	}

	return null;
};

const isInAngularFieldInitializer = (node: TSESTree.Node) => {
	const propertyDefinition = getEnclosingPropertyDefinition(node);
	if (!propertyDefinition || propertyDefinition.value === null) return false;

	return getEnclosingAngularComponentClass(propertyDefinition) !== null;
};

const isBannedCall = (node: TSESTree.CallExpression) =>
	isStaticMemberCall(node, "Math", "random") ||
	isStaticMemberCall(node, "Date", "now") ||
	isStaticMemberCall(node, "crypto", "randomUUID") ||
	isStaticMemberCall(node, "performance", "now");

export const noNondeterministicRender: TSESLint.RuleModule<
	MessageIds,
	Options
> = {
	create(context) {
		const reportField = (node: TSESTree.Node) => {
			if (!isInAngularFieldInitializer(node)) return;

			context.report({
				messageId: "nondeterministicField",
				node
			});
		};

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (isBannedCall(node)) reportField(node);
			},
			"ClassDeclaration > Decorator CallExpression > ObjectExpression > Property"(
				node: TSESTree.Property
			) {
				if (getPropertyName(node) !== "template") return;

				const templateText = getTemplateText(node.value);
				if (
					templateText === null ||
					!BANNED_TEMPLATE_PATTERN.test(templateText)
				) {
					return;
				}

				context.report({
					messageId: "nondeterministicTemplate",
					node: node.value
				});
			},
			NewExpression(node: TSESTree.NewExpression) {
				if (
					isIdentifier(node.callee, "Date") &&
					node.arguments.length === 0
				) {
					reportField(node);
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow nondeterministic values in Angular render paths that can cause SSR hydration mismatches."
		},
		messages: {
			nondeterministicField:
				"Do not use nondeterministic values in Angular component field initializers. Inject AbsoluteJS deterministic tokens instead.",
			nondeterministicTemplate:
				"Do not use nondeterministic values in Angular templates. Compute a deterministic value before render instead."
		},
		schema: [],
		type: "problem"
	}
};
