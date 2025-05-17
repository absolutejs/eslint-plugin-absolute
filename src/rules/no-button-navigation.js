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
		 * Inspects an AST node *only* for MemberExpressions where
		 * the object is literally `window` and the property is `open` or `location`.
		 */
		function containsWindowNavigation(node) {
			let found = false;
			function inspect(n) {
				if (found || !n || typeof n !== "object") return;
				// Only match MemberExpressions on the global window identifier
				if (
					n.type === "MemberExpression" &&
					n.object.type === "Identifier" &&
					n.object.name === "window" &&
					n.property.type === "Identifier" &&
					(n.property.name === "open" ||
						n.property.name === "location")
				) {
					found = true;
					return;
				}
				// recurse into children—but skip walking back up via `parent`
				for (const key of Object.keys(n)) {
					if (key === "parent") continue;
					const child = n[key];
					if (Array.isArray(child)) {
						child.forEach(inspect);
					} else {
						inspect(child);
					}
				}
			}
			// If it's a function, start at its body; otherwise start at the node itself
			inspect(
				node.type === "ArrowFunctionExpression" ||
					node.type === "FunctionExpression"
					? node.body
					: node
			);
			return found;
		}

		return {
			JSXElement(node) {
				const { openingElement } = node;
				// only care about <button ...>
				if (
					openingElement.name.type === "JSXIdentifier" &&
					openingElement.name.name === "button"
				) {
					for (const attr of openingElement.attributes) {
						if (
							attr.type === "JSXAttribute" &&
							attr.name.name === "onClick" &&
							attr.value?.type === "JSXExpressionContainer"
						) {
							const expr = attr.value.expression;
							// only inspect the inline function, not any Identifier calls
							if (
								(expr.type === "ArrowFunctionExpression" ||
									expr.type === "FunctionExpression") &&
								containsWindowNavigation(expr)
							) {
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
