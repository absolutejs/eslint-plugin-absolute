export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate – if two or more are passed to the same component type, they’re assumed to be settings that belong on the parent.",
			category: "Best Practices",
			recommended: false
		}
	},
	create(context) {
		// A list of candidate variables for reporting (for general variables only).
		const candidateVariables = [];

		// Helper: Extract the component name from a JSXElement.
		function getJSXElementName(jsxElement) {
			if (
				!jsxElement ||
				!jsxElement.openingElement ||
				!jsxElement.openingElement.name
			) {
				return "";
			}
			const nameNode = jsxElement.openingElement.name;
			if (nameNode.type === "JSXIdentifier") {
				return nameNode.name;
			}
			if (nameNode.type === "JSXMemberExpression") {
				// Traverse to the rightmost identifier.
				let current = nameNode;
				while (current.property) {
					current = current.property;
				}
				if (current && current.type === "JSXIdentifier") {
					return current.name;
				}
			}
			return "";
		}

		// Helper: Check if the node is a call to useState.
		function isUseStateCall(node) {
			return (
				node &&
				node.type === "CallExpression" &&
				node.callee &&
				((node.callee.type === "Identifier" &&
					node.callee.name === "useState") ||
					(node.callee.type === "MemberExpression" &&
						node.callee.property &&
						node.callee.property.name === "useState"))
			);
		}

		// Helper: Check if a call expression is a hook call (other than useState).
		function isHookCall(node) {
			return (
				node &&
				node.type === "CallExpression" &&
				node.callee &&
				node.callee.type === "Identifier" &&
				/^use[A-Z]/.test(node.callee.name) &&
				node.callee.name !== "useState"
			);
		}

		// Helper: Walk upward to find the closest JSXElement ancestor.
		function getJSXAncestor(node) {
			let current = node.parent;
			while (current) {
				if (current.type === "JSXElement") {
					return current;
				}
				current = current.parent;
			}
			return null;
		}

		// Helper: Check whether the given node is inside a JSXAttribute "value"
		// that belongs to a context-like component (i.e. tag name ends with Provider or Context).
		function isContextProviderValueProp(node) {
			let current = node.parent;
			while (current) {
				if (
					current.type === "JSXAttribute" &&
					current.name &&
					current.name.name === "value"
				) {
					// current.parent should be a JSXOpeningElement.
					if (
						current.parent &&
						current.parent.type === "JSXOpeningElement"
					) {
						const nameNode = current.parent.name;
						if (nameNode.type === "JSXIdentifier") {
							const tagName = nameNode.name;
							if (
								tagName.endsWith("Provider") ||
								tagName.endsWith("Context")
							) {
								return true;
							}
						} else if (nameNode.type === "JSXMemberExpression") {
							// Get the rightmost identifier.
							let currentMember = nameNode;
							while (
								currentMember.type === "JSXMemberExpression"
							) {
								currentMember = currentMember.property;
							}
							if (
								currentMember &&
								currentMember.type === "JSXIdentifier"
							) {
								if (
									currentMember.name.endsWith("Provider") ||
									currentMember.name.endsWith("Context")
								) {
									return true;
								}
							}
						}
					}
				}
				current = current.parent;
			}
			return false;
		}

		// Helper: Determine if a JSXElement is a custom component (tag name begins with an uppercase letter).
		function isCustomJSXElement(jsxElement) {
			if (
				!jsxElement ||
				!jsxElement.openingElement ||
				!jsxElement.openingElement.name
			) {
				return false;
			}
			const nameNode = jsxElement.openingElement.name;
			if (nameNode.type === "JSXIdentifier") {
				return /^[A-Z]/.test(nameNode.name);
			}
			if (nameNode.type === "JSXMemberExpression") {
				let current = nameNode;
				while (current.object) {
					current = current.object;
				}
				return (
					current.type === "JSXIdentifier" &&
					/^[A-Z]/.test(current.name)
				);
			}
			return false;
		}

		// Helper: Find the nearest enclosing function (assumed to be the component).
		function getComponentFunction(node) {
			let current = node;
			while (current) {
				if (
					current.type === "FunctionDeclaration" ||
					current.type === "FunctionExpression" ||
					current.type === "ArrowFunctionExpression"
				) {
					return current;
				}
				current = current.parent;
			}
			return null;
		}

		// Analyze variable usage by iteratively traversing the component function's AST.
		// Only count a usage if it occurs inside a custom JSX element (and is not inside a context provider's "value" prop).
		function analyzeVariableUsage(
			declarationNode,
			varName,
			componentFunction
		) {
			const usage = { jsxUsageSet: new Set(), hasOutsideUsage: false };
			const sourceCode = context.getSourceCode();
			const visitorKeys = sourceCode.visitorKeys || {};

			// Iterative traversal using a stack.
			const stack = [];
			if (componentFunction.body.type === "BlockStatement") {
				for (let i = 0; i < componentFunction.body.body.length; i++) {
					stack.push(componentFunction.body.body[i]);
				}
			} else {
				stack.push(componentFunction.body);
			}

			while (stack.length) {
				const currentNode = stack.pop();
				if (!currentNode) continue;

				if (
					currentNode.type === "Identifier" &&
					currentNode.name === varName &&
					currentNode !== declarationNode
				) {
					// If the identifier is inside a "value" prop on a context-like component, ignore it.
					if (isContextProviderValueProp(currentNode)) {
						// Do not count this usage.
					} else {
						const jsxAncestor = getJSXAncestor(currentNode);
						if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
							usage.jsxUsageSet.add(jsxAncestor);
						} else {
							usage.hasOutsideUsage = true;
						}
					}
				}

				// Skip nested functions that shadow the variable.
				const isFunction =
					currentNode.type === "FunctionDeclaration" ||
					currentNode.type === "FunctionExpression" ||
					currentNode.type === "ArrowFunctionExpression";
				if (isFunction && currentNode !== componentFunction) {
					let shadows = false;
					if (currentNode.params && currentNode.params.length > 0) {
						for (let i = 0; i < currentNode.params.length; i++) {
							const param = currentNode.params[i];
							if (
								param.type === "Identifier" &&
								param.name === varName
							) {
								shadows = true;
								break;
							}
						}
					}
					if (shadows) continue;
				}

				const keys = visitorKeys[currentNode.type] || [];
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					const child = currentNode[key];
					if (Array.isArray(child)) {
						for (let j = 0; j < child.length; j++) {
							if (child[j] && typeof child[j].type === "string") {
								stack.push(child[j]);
							}
						}
					} else if (child && typeof child.type === "string") {
						stack.push(child);
					}
				}
			}
			return usage;
		}

		// Manage hook-derived variables.
		const componentHookVars = new WeakMap();
		function getHookSet(componentFunction) {
			if (!componentHookVars.has(componentFunction)) {
				componentHookVars.set(componentFunction, new Set());
			}
			return componentHookVars.get(componentFunction);
		}
		function hasHookDependency(node, hookSet) {
			const sourceCode = context.getSourceCode();
			const visitorKeys = sourceCode.visitorKeys || {};
			const stack = [node];
			while (stack.length) {
				const currentNode = stack.pop();
				if (!currentNode) continue;
				if (currentNode.type === "Identifier") {
					if (hookSet.has(currentNode.name)) {
						return true;
					}
				}
				const keys = visitorKeys[currentNode.type] || [];
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					const child = currentNode[key];
					if (Array.isArray(child)) {
						for (let j = 0; j < child.length; j++) {
							if (child[j] && typeof child[j].type === "string") {
								stack.push(child[j]);
							}
						}
					} else if (child && typeof child.type === "string") {
						stack.push(child);
					}
				}
			}
			return false;
		}

		return {
			VariableDeclarator(node) {
				const componentFunction = getComponentFunction(node);
				if (!componentFunction || !componentFunction.body) return;

				// Record hook-derived variables (for hooks other than useState).
				if (
					node.init &&
					node.id &&
					node.id.type === "Identifier" &&
					node.init.type === "CallExpression" &&
					isHookCall(node.init)
				) {
					const hookSet = getHookSet(componentFunction);
					hookSet.add(node.id.name);
				}

				// Case 1: useState destructuring (state & setter).
				if (
					node.init &&
					isUseStateCall(node.init) &&
					node.id.type === "ArrayPattern" &&
					node.id.elements.length >= 2
				) {
					const stateElem = node.id.elements[0];
					const setterElem = node.id.elements[1];
					if (
						!stateElem ||
						stateElem.type !== "Identifier" ||
						!setterElem ||
						setterElem.type !== "Identifier"
					) {
						return;
					}
					const stateVarName = stateElem.name;
					const setterVarName = setterElem.name;

					const stateUsage = analyzeVariableUsage(
						stateElem,
						stateVarName,
						componentFunction
					);
					const setterUsage = analyzeVariableUsage(
						setterElem,
						setterVarName,
						componentFunction
					);

					const stateExclusivelySingleJSX =
						!stateUsage.hasOutsideUsage &&
						stateUsage.jsxUsageSet.size === 1;
					const setterExclusivelySingleJSX =
						!setterUsage.hasOutsideUsage &&
						setterUsage.jsxUsageSet.size === 1;
					// Report immediately if both the state and setter are used exclusively
					// in the same single custom JSX element.
					if (
						stateExclusivelySingleJSX &&
						setterExclusivelySingleJSX &&
						[...stateUsage.jsxUsageSet][0] ===
							[...setterUsage.jsxUsageSet][0]
					) {
						context.report({
							node: node,
							message:
								"State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
							data: { stateVarName, setterVarName }
						});
					}
				}
				// Case 2: General variable.
				else if (node.id && node.id.type === "Identifier") {
					const varName = node.id.name;
					// Exempt variables that depend on hooks.
					if (node.init) {
						const hookSet = getHookSet(componentFunction);
						if (hasHookDependency(node.init, hookSet)) {
							return;
						}
					}
					const usage = analyzeVariableUsage(
						node.id,
						varName,
						componentFunction
					);
					// Instead of reporting immediately, add a candidate if the variable is used exclusively in a single custom JSX element.
					if (
						!usage.hasOutsideUsage &&
						usage.jsxUsageSet.size === 1
					) {
						const target = [...usage.jsxUsageSet][0];
						const componentName = getJSXElementName(target);
						candidateVariables.push({
							node,
							varName,
							componentName
						});
					}
				}
			},
			// At the end of the traversal, group candidate variables by the target component name.
			"Program:exit"() {
				const groups = new Map();
				candidateVariables.forEach((candidate) => {
					const key = candidate.componentName;
					if (!groups.has(key)) {
						groups.set(key, []);
					}
					groups.get(key).push(candidate);
				});
				// Only report candidates for a given component type if there is exactly one candidate.
				groups.forEach((candidates) => {
					if (candidates.length === 1) {
						const candidate = candidates[0];
						context.report({
							node: candidate.node,
							message:
								"Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component.",
							data: { varName: candidate.varName }
						});
					}
				});
			}
		};
	}
};
