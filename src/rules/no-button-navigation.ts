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
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + …)."
		},
		schema: [],
		messages: {
			noButtonNavigation:
				"Use an anchor tag for navigation instead of a button whose onClick handler changes the path. Detected: {{reason}}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed."
		}
	},

	defaultOptions: [],

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
			const parent = node.parent;
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
			const object = member.object;
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
			const object = member.object;
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
					sawReplaceCall: false,
					sawAllowedLocationRead: false
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

				const reason = state.reason;
				const sawReplaceCall = state.sawReplaceCall;
				const sawAllowedLocationRead = state.sawAllowedLocationRead;

				if (reason) {
					context.report({
						node: state.attribute,
						messageId: "noButtonNavigation",
						data: { reason }
					});
					return;
				}

				if (sawReplaceCall && !sawAllowedLocationRead) {
					context.report({
						node: state.attribute,
						messageId: "noButtonNavigation",
						data: {
							reason: "history.replaceState/pushState without reading window.location"
						}
					});
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
					sawReplaceCall: false,
					sawAllowedLocationRead: false
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

				const reason = state.reason;
				const sawReplaceCall = state.sawReplaceCall;
				const sawAllowedLocationRead = state.sawAllowedLocationRead;

				if (reason) {
					context.report({
						node: state.attribute,
						messageId: "noButtonNavigation",
						data: { reason }
					});
					return;
				}

				if (sawReplaceCall && !sawAllowedLocationRead) {
					context.report({
						node: state.attribute,
						messageId: "noButtonNavigation",
						data: {
							reason: "history.replaceState/pushState without reading window.location"
						}
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
			},

			AssignmentExpression(node: TSESTree.AssignmentExpression) {
				const state = getCurrentHandler();
				if (!state) {
					return;
				}
				if (node.left.type !== "MemberExpression") {
					return;
				}
				const left = node.left;

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
				const callee = node.callee;

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
			}
		};
	}
};
