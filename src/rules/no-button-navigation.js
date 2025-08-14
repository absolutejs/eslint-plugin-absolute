export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + …).",
			category: "Best Practices",
			recommended: false
		},
		schema: []
	},
	create(context) {
		/**
		 * Returns true if the given AST subtree contains a MemberExpression of
		 * the form `window.location.pathname`, `window.location.search`, or `window.location.hash`.
		 */
		function urlUsesAllowedLocation(argNode) {
			let allowed = false;
			const visited = new WeakSet();

			function check(n) {
				if (allowed || !n || typeof n !== "object" || visited.has(n))
					return;
				visited.add(n);

				if (
					n.type === "MemberExpression" &&
					n.object.type === "MemberExpression" &&
					n.object.object.type === "Identifier" &&
					n.object.object.name === "window" &&
					n.object.property.type === "Identifier" &&
					n.object.property.name === "location" &&
					n.property.type === "Identifier" &&
					(n.property.name === "pathname" ||
						n.property.name === "search" ||
						n.property.name === "hash")
				) {
					allowed = true;
					return;
				}

				for (const key of Object.keys(n)) {
					if (key === "parent") continue;
					const child = n[key];
					if (Array.isArray(child)) {
						child.forEach((c) => check(c));
					} else {
						check(child);
					}
				}
			}

			check(argNode);
			return allowed;
		}

		/**
		 * Returns an object { shouldReport, reason } after inspecting the
		 * function body for forbidden patterns.  - shouldReport is true if
		 * we must flag.  - reason explains which pattern was found.
		 */
		function containsWindowNavigation(node) {
			let reason = null;
			const visited = new WeakSet();
			let sawReplaceCall = false;
			let sawAllowedLocationRead = false;

			function inspect(n, parent) {
				if (reason || !n || typeof n !== "object" || visited.has(n))
					return;
				visited.add(n);

				// 1) window.open(...)
				if (
					n.type === "MemberExpression" &&
					n.object.type === "Identifier" &&
					n.object.name === "window" &&
					n.property.type === "Identifier" &&
					n.property.name === "open"
				) {
					reason = "window.open";
					return;
				}

				// 2) Assignment to window.location or window.location.*
				if (
					n.type === "AssignmentExpression" &&
					n.left.type === "MemberExpression"
				) {
					const left = n.left;

					// window.location = ...
					if (
						left.object.type === "Identifier" &&
						left.object.name === "window" &&
						left.property.type === "Identifier" &&
						left.property.name === "location"
					) {
						reason = "assignment to window.location";
						return;
					}

					// window.location.href = ...  OR  window.location.pathname =
					if (
						left.object.type === "MemberExpression" &&
						left.object.object.type === "Identifier" &&
						left.object.object.name === "window" &&
						left.object.property.type === "Identifier" &&
						left.object.property.name === "location"
					) {
						reason = "assignment to window.location sub-property";
						return;
					}
				}

				// 3) window.location.replace(...) (or any call on window.location besides .search/.hash)
				if (
					n.type === "MemberExpression" &&
					n.object.type === "MemberExpression" &&
					n.object.object.type === "Identifier" &&
					n.object.object.name === "window" &&
					n.object.property.type === "Identifier" &&
					n.object.property.name === "location" &&
					n.property.type === "Identifier" &&
					n.property.name === "replace"
				) {
					if (parent && parent.type === "CallExpression") {
						reason = "window.location.replace";
						return;
					}
				}

				// 4) window.history.pushState(...) or replaceState(...)
				if (
					n.type === "MemberExpression" &&
					n.object.type === "MemberExpression" &&
					n.object.object.type === "Identifier" &&
					n.object.object.name === "window" &&
					n.object.property.type === "Identifier" &&
					n.object.property.name === "history" &&
					n.property.type === "Identifier" &&
					(n.property.name === "pushState" ||
						n.property.name === "replaceState")
				) {
					sawReplaceCall = true;
				}

				// 5) Reading window.location.search, .pathname, or .hash
				if (
					n.type === "MemberExpression" &&
					n.object.type === "MemberExpression" &&
					n.object.object.type === "Identifier" &&
					n.object.object.name === "window" &&
					n.object.property.type === "Identifier" &&
					n.object.property.name === "location" &&
					n.property.type === "Identifier" &&
					(n.property.name === "search" ||
						n.property.name === "pathname" ||
						n.property.name === "hash")
				) {
					sawAllowedLocationRead = true;
				}

				// Recurse into children
				for (const key of Object.keys(n)) {
					if (key === "parent" || reason) continue;
					const child = n[key];
					if (Array.isArray(child)) {
						child.forEach((c) => inspect(c, n));
					} else {
						inspect(child, n);
					}
					if (reason) return;
				}
			}

			inspect(
				node.type === "ArrowFunctionExpression" ||
					node.type === "FunctionExpression"
					? node.body
					: node,
				null
			);

			if (reason) {
				return { shouldReport: true, reason };
			}
			if (sawReplaceCall && !sawAllowedLocationRead) {
				return {
					shouldReport: true,
					reason: "history.replace/pushState without reading window.location"
				};
			}
			return { shouldReport: false, reason: null };
		}

		return {
			JSXElement(node) {
				const { openingElement } = node;
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
							if (
								expr.type === "ArrowFunctionExpression" ||
								expr.type === "FunctionExpression"
							) {
								const { shouldReport, reason } =
									containsWindowNavigation(expr);
								if (shouldReport) {
									context.report({
										node: attr,
										message:
											`Use an anchor tag for navigation instead of a button whose onClick handler changes the path. ` +
											`Detected: ${reason}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed.`
									});
								}
							}
						}
					}
				}
			}
		};
	}
};
