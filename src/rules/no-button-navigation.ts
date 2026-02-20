import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "noButtonNavigation";

type HandlerState = {
	attribute: TSESTree.JSXAttribute;
	reason: string | null;
	sawReplaceCall: boolean;
	sawAllowedLocationRead: boolean;
};

export const noButtonNavigation: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const handlerStack: HandlerState[] = [];

		function getCurrentHandler(): HandlerState | null {
			const state = handlerStack[handlerStack.length - 1];
			if (!state) {
				return null;
			}
			return state;
		}

		function isOnClickButtonHandler(
			node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
		): TSESTree.JSXAttribute | null {
			const { parent } = node;
			if (!parent || parent.type !== "JSXExpressionContainer") {
				return null;
			}
			const attributeCandidate = parent.parent;
			if (
				!attributeCandidate ||
				attributeCandidate.type !== "JSXAttribute"
			) {
				return null;
			}
			const attr = attributeCandidate;
			if (
				!attr.name ||
				attr.name.type !== "JSXIdentifier" ||
				attr.name.name !== "onClick"
			) {
				return null;
			}
			const openingElementCandidate = attr.parent;
			if (
				!openingElementCandidate ||
				openingElementCandidate.type !== "JSXOpeningElement"
			) {
				return null;
			}
			const openingElement = openingElementCandidate;
			const tagNameNode = openingElement.name;
			if (
				tagNameNode.type !== "JSXIdentifier" ||
				tagNameNode.name !== "button"
			) {
				return null;
			}
			return attr;
		}

		function isWindowLocationMember(
			member: TSESTree.MemberExpression
		): boolean {
			const { object } = member;
			if (object.type !== "MemberExpression") {
				return false;
			}
			const outerObject = object.object;
			const outerProperty = object.property;
			if (
				outerObject.type === "Identifier" &&
				outerObject.name === "window" &&
				outerProperty.type === "Identifier" &&
				outerProperty.name === "location"
			) {
				return true;
			}
			return false;
		}

		function isWindowHistoryMember(
			member: TSESTree.MemberExpression
		): boolean {
			const { object } = member;
			if (object.type !== "MemberExpression") {
				return false;
			}
			const outerObject = object.object;
			const outerProperty = object.property;
			if (
				outerObject.type === "Identifier" &&
				outerObject.name === "window" &&
				outerProperty.type === "Identifier" &&
				outerProperty.name === "history"
			) {
				return true;
			}
			return false;
		}

		return {
			ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
				const attr = isOnClickButtonHandler(node);
				if (!attr) {
					return;
				}
				handlerStack.push({
					attribute: attr,
					reason: null,
					sawAllowedLocationRead: false,
					sawReplaceCall: false
				});
			},
			"ArrowFunctionExpression:exit"(
				node: TSESTree.ArrowFunctionExpression
			) {
				const attr = isOnClickButtonHandler(node);
				if (!attr) {
					return;
				}
				const state = handlerStack.pop();
				if (!state) {
					return;
				}

				const { reason } = state;
				const { sawReplaceCall } = state;
				const { sawAllowedLocationRead } = state;

				if (reason) {
					context.report({
						data: { reason },
						messageId: "noButtonNavigation",
						node: state.attribute
					});
					return;
				}

				if (sawReplaceCall && !sawAllowedLocationRead) {
					context.report({
						data: {
							reason: "history.replaceState/pushState without reading window.location"
						},
						messageId: "noButtonNavigation",
						node: state.attribute
					});
				}
			},
			AssignmentExpression(node: TSESTree.AssignmentExpression) {
				const state = getCurrentHandler();
				if (!state) {
					return;
				}
				if (node.left.type !== "MemberExpression") {
					return;
				}
				const { left } = node;

				// window.location = ...
				if (
					left.object.type === "Identifier" &&
					left.object.name === "window" &&
					left.property.type === "Identifier" &&
					left.property.name === "location"
				) {
					if (!state.reason) {
						state.reason = "assignment to window.location";
					}
					return;
				}

				// window.location.href = ... OR window.location.pathname = ...
				if (isWindowLocationMember(left)) {
					if (!state.reason) {
						state.reason =
							"assignment to window.location sub-property";
					}
				}
			},
			CallExpression(node: TSESTree.CallExpression) {
				const state = getCurrentHandler();
				if (!state) {
					return;
				}
				const { callee } = node;

				if (callee.type !== "MemberExpression") {
					return;
				}

				// 3) window.location.replace(...)
				if (
					isWindowLocationMember(callee) &&
					callee.property.type === "Identifier" &&
					callee.property.name === "replace"
				) {
					if (!state.reason) {
						state.reason = "window.location.replace";
					}
					return;
				}

				// 4) window.history.pushState(...) or replaceState(...)
				if (
					isWindowHistoryMember(callee) &&
					callee.property.type === "Identifier" &&
					(callee.property.name === "pushState" ||
						callee.property.name === "replaceState")
				) {
					state.sawReplaceCall = true;
				}
			},
			FunctionExpression(node: TSESTree.FunctionExpression) {
				const attr = isOnClickButtonHandler(node);
				if (!attr) {
					return;
				}
				handlerStack.push({
					attribute: attr,
					reason: null,
					sawAllowedLocationRead: false,
					sawReplaceCall: false
				});
			},
			"FunctionExpression:exit"(node: TSESTree.FunctionExpression) {
				const attr = isOnClickButtonHandler(node);
				if (!attr) {
					return;
				}
				const state = handlerStack.pop();
				if (!state) {
					return;
				}

				const { reason } = state;
				const { sawReplaceCall } = state;
				const { sawAllowedLocationRead } = state;

				if (reason) {
					context.report({
						data: { reason },
						messageId: "noButtonNavigation",
						node: state.attribute
					});
					return;
				}

				if (sawReplaceCall && !sawAllowedLocationRead) {
					context.report({
						data: {
							reason: "history.replaceState/pushState without reading window.location"
						},
						messageId: "noButtonNavigation",
						node: state.attribute
					});
				}
			},
			MemberExpression(node: TSESTree.MemberExpression) {
				const state = getCurrentHandler();
				if (!state) {
					return;
				}

				// 1) window.open(...)
				if (
					node.object.type === "Identifier" &&
					node.object.name === "window" &&
					node.property.type === "Identifier" &&
					node.property.name === "open"
				) {
					if (!state.reason) {
						state.reason = "window.open";
					}
				}

				// 5) Reading window.location.search, .pathname, or .hash
				if (
					isWindowLocationMember(node) &&
					node.property.type === "Identifier" &&
					(node.property.name === "search" ||
						node.property.name === "pathname" ||
						node.property.name === "hash")
				) {
					state.sawAllowedLocationRead = true;
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + …)."
		},
		messages: {
			noButtonNavigation:
				"Use an anchor tag for navigation instead of a button whose onClick handler changes the path. Detected: {{reason}}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed."
		},
		schema: [],
		type: "suggestion"
	}
};
