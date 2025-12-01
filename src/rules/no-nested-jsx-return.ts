import { TSESLint, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

/**
 * @fileoverview Disallow nested functions that return non-component, non-singular JSX
 * to enforce one component per file.
 */

type Options = [];
type MessageIds =
	| "nestedFunctionJSX"
	| "nestedArrowJSX"
	| "nestedArrowFragment";

type AnyFunctionNode =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

export const noNestedJSXReturn: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow nested functions that return non-component, non-singular JSX to enforce one component per file"
		},
		schema: [],
		messages: {
			nestedFunctionJSX:
				"Nested function returning non-component, non-singular JSX detected. Extract it into its own component.",
			nestedArrowJSX:
				"Nested arrow function returning non-component, non-singular JSX detected. Extract it into its own component.",
			nestedArrowFragment:
				"Nested arrow function returning a non-singular JSX fragment detected. Extract it into its own component."
		}
	},

	defaultOptions: [],

	create(context) {
		// Returns true if the node is a JSX element or fragment.
		function isJSX(
			node: TSESTree.Node | null | undefined
		): node is TSESTree.JSXElement | TSESTree.JSXFragment {
			return (
				!!node &&
				(node.type === AST_NODE_TYPES.JSXElement ||
					node.type === AST_NODE_TYPES.JSXFragment)
			);
		}

		function getLeftmostJSXIdentifier(
			name: TSESTree.JSXTagNameExpression
		): TSESTree.JSXIdentifier | null {
			let current: TSESTree.JSXTagNameExpression = name;
			while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
				current = current.object;
			}
			if (current.type === AST_NODE_TYPES.JSXIdentifier) {
				return current;
			}
			return null;
		}

		// Returns true if the JSX element is a component (its tag name starts with an uppercase letter).
		function isJSXComponentElement(node: TSESTree.Node | null | undefined) {
			if (!node || node.type !== AST_NODE_TYPES.JSXElement) {
				return false;
			}
			const opening = node.openingElement;
			const nameNode = opening.name;

			if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
				return /^[A-Z]/.test(nameNode.name);
			}

			const leftmost = getLeftmostJSXIdentifier(nameNode);
			if (!leftmost) {
				return false;
			}
			return /^[A-Z]/.test(leftmost.name);
		}

		// Returns true if the returned JSX is singular.
		// For both JSXElement and JSXFragment, singular means 0 or 1 non-whitespace child.
		function isSingularJSXReturn(
			node: TSESTree.JSXElement | TSESTree.JSXFragment
		) {
			if (!isJSX(node)) return false;

			const children = node.children.filter((child) => {
				if (child.type === AST_NODE_TYPES.JSXText) {
					return child.value.trim() !== "";
				}
				return true;
			});

			// If there are no children, it's singular.
			if (children.length === 0) {
				return true;
			}

			// Check if the returned element has exactly one child.
			if (children.length === 1) {
				const child = children[0];
				if (!child) {
					return false;
				}

				// If the singular child is also a JSX element or fragment,
				// ensure that it doesn't have any meaningful children.
				if (
					child.type === AST_NODE_TYPES.JSXElement ||
					child.type === AST_NODE_TYPES.JSXFragment
				) {
					const innerChildren = child.children.filter(
						(innerChild) => {
							if (innerChild.type === AST_NODE_TYPES.JSXText) {
								return innerChild.value.trim() !== "";
							}
							return true;
						}
					);
					return innerChildren.length === 0;
				}
				// If it’s not a JSX element (maybe a simple expression), it's acceptable.
				return true;
			}

			// If there is more than one meaningful child, it's not singular.
			return false;
		}

		// Stack to track nested function nodes.
		const functionStack: AnyFunctionNode[] = [];
		function pushFunction(node: AnyFunctionNode) {
			functionStack.push(node);
		}
		function popFunction() {
			functionStack.pop();
		}

		return {
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node: AnyFunctionNode
			) {
				pushFunction(node);
			},
			"FunctionDeclaration:exit"(_node: TSESTree.FunctionDeclaration) {
				popFunction();
			},
			"FunctionExpression:exit"(_node: TSESTree.FunctionExpression) {
				popFunction();
			},
			"ArrowFunctionExpression:exit"(
				_node: TSESTree.ArrowFunctionExpression
			) {
				popFunction();
			},

			// For explicit return statements, report if the returned JSX is not a component and not singular.
			ReturnStatement(node: TSESTree.ReturnStatement) {
				if (functionStack.length <= 1) {
					return;
				}
				const argument = node.argument;
				if (!isJSX(argument)) {
					return;
				}
				if (
					!isJSXComponentElement(argument) &&
					!isSingularJSXReturn(argument)
				) {
					context.report({
						node,
						messageId: "nestedFunctionJSX"
					});
				}
			},

			// For implicit returns in arrow functions, use the same checks.
			"ArrowFunctionExpression > JSXElement"(node: TSESTree.JSXElement) {
				if (functionStack.length <= 1) {
					return;
				}
				if (
					!isJSXComponentElement(node) &&
					!isSingularJSXReturn(node)
				) {
					context.report({
						node,
						messageId: "nestedArrowJSX"
					});
				}
			},
			"ArrowFunctionExpression > JSXFragment"(
				node: TSESTree.JSXFragment
			) {
				if (functionStack.length <= 1) {
					return;
				}
				if (!isSingularJSXReturn(node)) {
					context.report({
						node,
						messageId: "nestedArrowFragment"
					});
				}
			}
		};
	}
};
