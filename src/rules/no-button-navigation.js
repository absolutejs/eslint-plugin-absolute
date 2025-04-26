export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce using anchor tags for navigation instead of buttons with onClick handlers that use window navigation methods (e.g., window.location, window.open)",
			category: "Best Practices",
			recommended: false
		},
		schema: []
	},
	create(context) {
		/**
		 * Recursively inspects an AST node to see if it contains a reference to window.location or window.open.
		 * Uses a WeakSet to track visited nodes to avoid infinite recursion.
		 * @param {ASTNode} node - The node to inspect.
		 * @returns {boolean} True if a window navigation reference is found.
		 */
		function containsWindowNavigation(node) {
			let found = false;
			const visited = new WeakSet();
			function inspect(n) {
				if (!n || found) return;
				if (typeof n !== "object") return; // Only objects can be added to WeakSet
				if (visited.has(n)) return;
				visited.add(n);

				// Check for MemberExpressions like window.location or window.open
				if (n.type === "MemberExpression") {
					if (
						n.object &&
						n.object.type === "Identifier" &&
						n.object.name === "window" &&
						n.property &&
						((n.property.type === "Identifier" &&
							(n.property.name === "location" ||
								n.property.name === "open")) ||
							(n.property.type === "Literal" &&
								(n.property.value === "location" ||
									n.property.value === "open")))
					) {
						found = true;
						return;
					}
				}
				// Check for CallExpressions like window.open()
				if (
					n.type === "CallExpression" &&
					n.callee &&
					n.callee.type === "MemberExpression"
				) {
					const callee = n.callee;
					if (
						callee.object &&
						callee.object.type === "Identifier" &&
						callee.object.name === "window" &&
						callee.property &&
						callee.property.type === "Identifier" &&
						callee.property.name === "open"
					) {
						found = true;
						return;
					}
				}
				// Recursively inspect all child nodes
				for (const key in n) {
					if (Object.prototype.hasOwnProperty.call(n, key)) {
						const child = n[key];
						if (Array.isArray(child)) {
							child.forEach(inspect);
						} else if (child && typeof child === "object") {
							inspect(child);
						}
					}
				}
			}
			inspect(node);
			return found;
		}

		return {
			JSXElement(node) {
				const openingElement = node.openingElement;
				// Check if the element is a <button>
				if (
					openingElement.name &&
					openingElement.name.type === "JSXIdentifier" &&
					openingElement.name.name === "button"
				) {
					// Look for the onClick attribute
					const attributes = openingElement.attributes;
					for (const attr of attributes) {
						if (
							attr.type === "JSXAttribute" &&
							attr.name &&
							attr.name.name === "onClick" &&
							attr.value &&
							attr.value.type === "JSXExpressionContainer"
						) {
							const expression = attr.value.expression;
							if (containsWindowNavigation(expression)) {
								context.report({
									node: attr,
									message:
										"Use an anchor tag for navigation instead of a button with an onClick handler that uses window navigation methods."
								});
							}
						}
					}
				}
			}
		};
	}
};
