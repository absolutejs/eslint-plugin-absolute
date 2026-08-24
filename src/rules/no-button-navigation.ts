import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "noButtonNavigation";

type DetectionState = {
	reason: string | null;
	sawAllowedLocationRead: boolean;
	sawHistoryCall: boolean;
};

type HandlerState = DetectionState & {
	attribute: TSESTree.JSXAttribute;
};

type FunctionState = DetectionState & {
	name: string | null;
};

type TemplateVisitor = {
	VElement: (node: AST.VElement) => void;
};

const LAST_ITEM = -1;
const EMPTY_DETECTION: DetectionState = {
	reason: null,
	sawAllowedLocationRead: false,
	sawHistoryCall: false
};

const emptyDetection = () => ({ ...EMPTY_DETECTION });

const isWindowLocationMember = (member: TSESTree.MemberExpression) => {
	const { object } = member;
	if (object.type !== "MemberExpression") return false;

	return (
		object.object.type === "Identifier" &&
		object.object.name === "window" &&
		object.property.type === "Identifier" &&
		object.property.name === "location"
	);
};

const isWindowHistoryMember = (member: TSESTree.MemberExpression) => {
	const { object } = member;
	if (object.type !== "MemberExpression") return false;

	return (
		object.object.type === "Identifier" &&
		object.object.name === "window" &&
		object.property.type === "Identifier" &&
		object.property.name === "history"
	);
};

const applyAssignment = (
	state: DetectionState,
	node: TSESTree.AssignmentExpression
) => {
	if (state.reason || node.left.type !== "MemberExpression") return;
	const { left } = node;
	if (
		left.object.type === "Identifier" &&
		left.object.name === "window" &&
		left.property.type === "Identifier" &&
		left.property.name === "location"
	) {
		state.reason = "assignment to window.location";
		return;
	}
	if (isWindowLocationMember(left)) {
		state.reason = "assignment to a window.location property";
	}
};

const applyCall = (state: DetectionState, node: TSESTree.CallExpression) => {
	if (node.callee.type !== "MemberExpression") return;
	const { callee } = node;
	if (
		!state.reason &&
		callee.object.type === "Identifier" &&
		callee.object.name === "window" &&
		callee.property.type === "Identifier" &&
		callee.property.name === "open"
	) {
		state.reason = "window.open";
		return;
	}
	if (
		!state.reason &&
		isWindowLocationMember(callee) &&
		callee.property.type === "Identifier" &&
		(callee.property.name === "assign" ||
			callee.property.name === "replace")
	) {
		state.reason = `window.location.${callee.property.name}`;
		return;
	}
	if (
		isWindowHistoryMember(callee) &&
		callee.property.type === "Identifier" &&
		(callee.property.name === "pushState" ||
			callee.property.name === "replaceState")
	) {
		state.sawHistoryCall = true;
	}
};

const applyLocationRead = (
	state: DetectionState,
	node: TSESTree.MemberExpression
) => {
	if (
		isWindowLocationMember(node) &&
		node.property.type === "Identifier" &&
		(node.property.name === "search" ||
			node.property.name === "pathname" ||
			node.property.name === "hash")
	) {
		state.sawAllowedLocationRead = true;
	}
};

const detectionReason = (state: DetectionState) =>
	state.reason ??
	(state.sawHistoryCall && !state.sawAllowedLocationRead
		? "history.replaceState/pushState without reading window.location"
		: null);

const functionName = (
	node:
		| TSESTree.ArrowFunctionExpression
		| TSESTree.FunctionDeclaration
		| TSESTree.FunctionExpression
) => {
	if (node.type === "FunctionDeclaration") return node.id?.name ?? null;
	if (
		node.parent?.type === "VariableDeclarator" &&
		node.parent.id.type === "Identifier"
	) {
		return node.parent.id.name;
	}

	return null;
};

const isNavigationOnlyFunction = (
	node:
		| TSESTree.ArrowFunctionExpression
		| TSESTree.FunctionDeclaration
		| TSESTree.FunctionExpression
) => {
	if (node.body.type !== "BlockStatement") return true;
	const statements = node.body.body.filter(
		(statement) => statement.type !== "EmptyStatement"
	);
	if (statements.length !== 1) return false;
	const [statement] = statements;

	return (
		statement?.type === "ExpressionStatement" ||
		(statement?.type === "ReturnStatement" && statement.argument !== null)
	);
};

const clickAttribute = (
	node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
) => {
	if (node.parent?.type !== "JSXExpressionContainer") return null;
	const attribute = node.parent.parent;
	if (
		attribute?.type !== "JSXAttribute" ||
		attribute.name.type !== "JSXIdentifier" ||
		attribute.name.name !== "onClick"
	) {
		return null;
	}
	const openingElement = attribute.parent;
	if (
		openingElement?.type !== "JSXOpeningElement" ||
		openingElement.name.type !== "JSXIdentifier" ||
		openingElement.name.name !== "button"
	) {
		return null;
	}

	return attribute;
};

const buttonClickDirective = (node: AST.VElement) => {
	if (node.rawName.toLowerCase() !== "button") return null;

	return (
		node.startTag.attributes.find(
			(attribute): attribute is AST.VDirective =>
				attribute.directive &&
				attribute.key.name.name === "on" &&
				attribute.key.argument?.type === "VIdentifier" &&
				attribute.key.argument.name === "click"
		) ?? null
	);
};

const isAstNode = (value: unknown): value is TSESTree.Node => {
	if (value === null || typeof value !== "object" || !("type" in value)) {
		return false;
	}

	return typeof value.type === "string";
};

const applyNamedNavigationCall = (
	state: DetectionState,
	call: TSESTree.CallExpression,
	navigationFunctions: ReadonlyMap<string, string>
) => {
	if (call.callee.type !== "Identifier" || state.reason) return;
	const reason = navigationFunctions.get(call.callee.name);
	if (!reason) return;
	state.reason = `${call.callee.name} handler: ${reason}`;
};

const applyNamedNavigationIdentifier = (
	state: DetectionState,
	identifier: TSESTree.Identifier,
	navigationFunctions: ReadonlyMap<string, string>
) => {
	if (state.reason) return;
	const reason = navigationFunctions.get(identifier.name);
	if (!reason) return;
	state.reason = `${identifier.name} handler: ${reason}`;
};

const collectExpressionNavigation = (
	value: unknown,
	state: DetectionState,
	navigationFunctions: ReadonlyMap<string, string>,
	pending: unknown[],
	seen: WeakSet<object>
) => {
	if (Array.isArray(value)) {
		pending.push(...value);

		return;
	}
	if (!isAstNode(value) || seen.has(value)) return;
	seen.add(value);
	if (value.type === "AssignmentExpression") applyAssignment(state, value);
	if (value.type === "CallExpression") {
		applyCall(state, value);
		applyNamedNavigationCall(state, value, navigationFunctions);
	}
	if (value.type === "Identifier") {
		applyNamedNavigationIdentifier(state, value, navigationFunctions);
	}
	if (value.type === "MemberExpression") applyLocationRead(state, value);
	Object.entries(value).forEach(([key, child]) => {
		if (!["parent", "loc", "range", "references"].includes(key)) {
			pending.push(child);
		}
	});
};

const expressionReason = (
	value: unknown,
	navigationFunctions: ReadonlyMap<string, string>
) => {
	const state = emptyDetection();
	const seen = new WeakSet<object>();
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		collectExpressionNavigation(
			pending.pop(),
			state,
			navigationFunctions,
			pending,
			seen
		);
	}

	return detectionReason(state);
};

export const noButtonNavigation = createRule<Options, MessageIds>({
	create(context) {
		const handlerStack: HandlerState[] = [];
		const functionStack: FunctionState[] = [];
		const navigationFunctions = new Map<string, string>();
		const currentHandler = () => handlerStack.at(LAST_ITEM) ?? null;
		const currentFunction = () => functionStack.at(LAST_ITEM) ?? null;
		const activeStates = () => {
			const states: DetectionState[] = [];
			const handler = currentHandler();
			const functionState = currentFunction();
			if (handler) states.push(handler);
			if (functionState) states.push(functionState);

			return states;
		};
		const report = (
			node: TSESTree.Node | AST.VDirective,
			reason: string
		) => {
			context.report({
				data: { reason },
				loc: node.loc,
				messageId: "noButtonNavigation"
			});
		};
		const enterClickHandler = (
			node:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionExpression
		) => {
			const attribute = clickAttribute(node);
			if (!attribute) return;
			handlerStack.push({ ...emptyDetection(), attribute });
		};
		const enterFunction = (
			node:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
		) => {
			functionStack.push({
				...emptyDetection(),
				name: functionName(node)
			});
			if (node.type === "FunctionDeclaration") return;
			enterClickHandler(node);
		};
		const exitClickHandler = (
			node:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionExpression
		) => {
			const attribute = clickAttribute(node);
			if (!attribute) return;
			const handlerState = handlerStack.pop();
			const handlerReason = handlerState
				? detectionReason(handlerState)
				: null;
			if (handlerReason) report(attribute, handlerReason);
		};
		const exitFunction = (
			node:
				| TSESTree.ArrowFunctionExpression
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
		) => {
			const functionState = functionStack.pop();
			const reason = functionState
				? detectionReason(functionState)
				: null;
			if (
				functionState?.name &&
				reason &&
				isNavigationOnlyFunction(node)
			) {
				navigationFunctions.set(functionState.name, reason);
			}
			if (node.type === "FunctionDeclaration") return;
			exitClickHandler(node);
		};

		const scriptVisitor: TSESLint.RuleListener = {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			AssignmentExpression(node: TSESTree.AssignmentExpression) {
				activeStates().forEach((state) => applyAssignment(state, node));
			},
			CallExpression(node: TSESTree.CallExpression) {
				activeStates().forEach((state) => applyCall(state, node));
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
			JSXAttribute(node: TSESTree.JSXAttribute) {
				if (
					node.name.type !== "JSXIdentifier" ||
					node.name.name !== "onClick" ||
					node.parent?.type !== "JSXOpeningElement" ||
					node.parent.name.type !== "JSXIdentifier" ||
					node.parent.name.name !== "button" ||
					node.value?.type !== "JSXExpressionContainer" ||
					node.value.expression?.type === "ArrowFunctionExpression" ||
					node.value.expression?.type === "FunctionExpression"
				) {
					return;
				}
				const reason = expressionReason(
					node.value.expression,
					navigationFunctions
				);
				if (reason) report(node, reason);
			},
			MemberExpression(node: TSESTree.MemberExpression) {
				activeStates().forEach((state) =>
					applyLocationRead(state, node)
				);
			}
		};
		const { parserServices } = context.sourceCode;
		if (
			!parserServices ||
			!("defineTemplateBodyVisitor" in parserServices) ||
			typeof parserServices.defineTemplateBodyVisitor !== "function"
		) {
			return scriptVisitor;
		}

		return parserServices.defineTemplateBodyVisitor(
			{
				VElement(node) {
					const directive = buttonClickDirective(node);
					if (!directive) return;
					const reason = expressionReason(
						directive.value?.expression,
						navigationFunctions
					);
					if (reason) report(directive, reason);
				}
			} satisfies TemplateVisitor,
			scriptVisitor
		);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require semantic links for navigation-only controls: anchors for external or new-tab destinations and framework router-link components for internal SPA routes."
		},
		messages: {
			noButtonNavigation:
				"Use a semantic link for navigation instead of a button: an <a> for external or new-tab destinations, or the framework router-link component for internal SPA routes. Detected: {{reason}}."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-button-navigation"
});
