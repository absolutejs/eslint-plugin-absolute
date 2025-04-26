export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow nested functions that return non-component, non-singular JSX to enforce one component per file",
			recommended: false
		},
		schema: []
	},
	create(context) {
		// Returns true if the node is a JSX element or fragment.
		function isJSX(node) {
			return (
				node &&
				(node.type === "JSXElement" || node.type === "JSXFragment")
			);
		}

		// Returns true if the JSX element is a component (its tag name starts with an uppercase letter).
		function isJSXComponentElement(node) {
			if (node && node.type === "JSXElement") {
				const opening = node.openingElement;
				if (opening && opening.name) {
					if (opening.name.type === "JSXIdentifier") {
						return /^[A-Z]/.test(opening.name.name);
					}
					if (opening.name.type === "JSXMemberExpression") {
						let current = opening.name;
						while (
							current &&
							current.type === "JSXMemberExpression"
						) {
							current = current.object;
						}
						return (
							current &&
							current.type === "JSXIdentifier" &&
							/^[A-Z]/.test(current.name)
						);
					}
				}
				return false;
			}
			return false;
		}

		// Returns true if the returned JSX is singular.
		// For both JSXElement and JSXFragment, singular means 0 or 1 non-whitespace child.
		function isSingularJSXReturn(node) {
			if (!isJSX(node)) return false;
			let children = [];
			if (node.type === "JSXElement" || node.type === "JSXFragment") {
				children = node.children.filter((child) => {
					if (child.type === "JSXText") {
						return child.value.trim() !== "";
					}
					return true;
				});
				// Check if the returned element has exactly one child.
				if (children.length === 1) {
					const child = children[0];
					// If the singular child is also a JSX element or fragment,
					// ensure that it doesn't have any meaningful children.
					if (
						child.type === "JSXElement" ||
						child.type === "JSXFragment"
					) {
						const innerChildren = child.children.filter(
							(innerChild) => {
								if (innerChild.type === "JSXText") {
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
				// If there are no children or more than one child, it's not singular.
				return children.length === 0;
			}
			return false;
		}

		// Stack to track nested function nodes.
		const functionStack = [];
		function pushFunction(node) {
			functionStack.push(node);
		}
		function popFunction() {
			functionStack.pop();
		}

		return {
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node
			) {
				pushFunction(node);
			},
			"FunctionDeclaration:exit"(node) {
				popFunction();
			},
			"FunctionExpression:exit"(node) {
				popFunction();
			},
			"ArrowFunctionExpression:exit"(node) {
				popFunction();
			},

			// For explicit return statements, report if the returned JSX is not a component and not singular.
			ReturnStatement(node) {
				if (
					functionStack.length > 1 &&
					isJSX(node.argument) &&
					!isJSXComponentElement(node.argument) &&
					!isSingularJSXReturn(node.argument)
				) {
					context.report({
						node,
						message:
							"Nested function returning non-component, non-singular JSX detected. Extract it into its own component."
					});
				}
			},

			// For implicit returns in arrow functions, use the same checks.
			"ArrowFunctionExpression > JSXElement"(node) {
				if (
					functionStack.length > 1 &&
					!isJSXComponentElement(node) &&
					!isSingularJSXReturn(node)
				) {
					context.report({
						node,
						message:
							"Nested arrow function returning non-component, non-singular JSX detected. Extract it into its own component."
					});
				}
			},
			"ArrowFunctionExpression > JSXFragment"(node) {
				if (functionStack.length > 1 && !isSingularJSXReturn(node)) {
					context.report({
						node,
						message:
							"Nested arrow function returning a non-singular JSX fragment detected. Extract it into its own component."
					});
				}
			}
		};
	}
};
