import { TSESLint, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "stateAndSetterToChild" | "variableToChild";

type ComponentFunction =
	| TSESTree.FunctionDeclaration
	| TSESTree.FunctionExpression
	| TSESTree.ArrowFunctionExpression;

type Usage = {
	jsxUsageSet: Set<TSESTree.JSXElement>;
	hasOutsideUsage: boolean;
};

type CandidateVariable = {
	node: TSESTree.VariableDeclarator;
	varName: string;
	componentName: string;
};

export const localizeReactProps: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate – if two or more are passed to the same component type, they’re assumed to be settings that belong on the parent."
		},
		schema: [],
		messages: {
			stateAndSetterToChild:
				"State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
			variableToChild:
				"Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component."
		}
	},

	defaultOptions: [],

	create(context) {
		// A list of candidate variables for reporting (for general variables only).
		const candidateVariables: CandidateVariable[] = [];

		function getSingleSetElement<T>(set: Set<T>): T | null {
			for (const value of set) {
				return value;
			}
			return null;
		}

		function getRightmostJSXIdentifier(
			name: TSESTree.JSXTagNameExpression
		): TSESTree.JSXIdentifier | null {
			let current: TSESTree.JSXTagNameExpression = name;
			while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
				current = current.property;
			}
			if (current.type === AST_NODE_TYPES.JSXIdentifier) {
				return current;
			}
			return null;
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

		// Helper: Extract the component name from a JSXElement.
		function getJSXElementName(jsxElement: TSESTree.JSXElement | null) {
			if (
				!jsxElement ||
				!jsxElement.openingElement ||
				!jsxElement.openingElement.name
			) {
				return "";
			}
			const nameNode = jsxElement.openingElement.name;
			if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
				return nameNode.name;
			}
			const rightmost = getRightmostJSXIdentifier(nameNode);
			if (rightmost) {
				return rightmost.name;
			}
			return "";
		}

		// Helper: Check if the node is a call to useState.
		function isUseStateCall(
			node: TSESTree.Node | null
		): node is TSESTree.CallExpression {
			return (
				node !== null &&
				node.type === AST_NODE_TYPES.CallExpression &&
				node.callee !== null &&
				((node.callee.type === AST_NODE_TYPES.Identifier &&
					node.callee.name === "useState") ||
					(node.callee.type === AST_NODE_TYPES.MemberExpression &&
						node.callee.property !== null &&
						node.callee.property.type ===
							AST_NODE_TYPES.Identifier &&
						node.callee.property.name === "useState"))
			);
		}

		// Helper: Check if a call expression is a hook call (other than useState).
		function isHookCall(
			node: TSESTree.Node | null
		): node is TSESTree.CallExpression {
			return (
				node !== null &&
				node.type === AST_NODE_TYPES.CallExpression &&
				node.callee !== null &&
				node.callee.type === AST_NODE_TYPES.Identifier &&
				/^use[A-Z]/.test(node.callee.name) &&
				node.callee.name !== "useState"
			);
		}

		// Helper: Walk upward to find the closest JSXElement ancestor.
		function getJSXAncestor(
			node: TSESTree.Node
		): TSESTree.JSXElement | null {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				if (current.type === AST_NODE_TYPES.JSXElement) {
					return current;
				}
				current = current.parent;
			}
			return null;
		}

		// Helper: Check whether the given node is inside a JSXAttribute "value"
		// that belongs to a context-like component (i.e. tag name ends with Provider or Context).
		function isContextProviderValueProp(node: TSESTree.Node): boolean {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				if (
					current.type === AST_NODE_TYPES.JSXAttribute &&
					current.name &&
					current.name.type === AST_NODE_TYPES.JSXIdentifier &&
					current.name.name === "value"
				) {
					// current.parent should be a JSXOpeningElement.
					if (
						current.parent &&
						current.parent.type === AST_NODE_TYPES.JSXOpeningElement
					) {
						const nameNode = current.parent.name;
						if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
							const tagName = nameNode.name;
							if (
								tagName.endsWith("Provider") ||
								tagName.endsWith("Context")
							) {
								return true;
							}
						} else {
							const rightmost =
								getRightmostJSXIdentifier(nameNode);
							if (rightmost) {
								if (
									rightmost.name.endsWith("Provider") ||
									rightmost.name.endsWith("Context")
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
		function isCustomJSXElement(jsxElement: TSESTree.JSXElement | null) {
			if (
				!jsxElement ||
				!jsxElement.openingElement ||
				!jsxElement.openingElement.name
			) {
				return false;
			}
			const nameNode = jsxElement.openingElement.name;
			if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
				return /^[A-Z]/.test(nameNode.name);
			}
			const leftmost = getLeftmostJSXIdentifier(nameNode);
			if (leftmost && /^[A-Z]/.test(leftmost.name)) {
				return true;
			}
			return false;
		}

		// Helper: Find the nearest enclosing function (assumed to be the component).
		function getComponentFunction(
			node: TSESTree.Node | null
		): ComponentFunction | null {
			let current: TSESTree.Node | null | undefined = node;
			while (current) {
				if (
					current.type === AST_NODE_TYPES.FunctionDeclaration ||
					current.type === AST_NODE_TYPES.FunctionExpression ||
					current.type === AST_NODE_TYPES.ArrowFunctionExpression
				) {
					return current;
				}
				current = current.parent;
			}
			return null;
		}

		function findVariableForIdentifier(
			id: TSESTree.Identifier
		): TSESLint.Scope.Variable | null {
			let scope: TSESLint.Scope.Scope | null = context.getScope();
			while (scope) {
				for (const variable of scope.variables) {
					for (const def of variable.defs) {
						if (def.name === id) {
							return variable;
						}
					}
				}
				scope = scope.upper ?? null;
			}
			return null;
		}

		// Analyze variable usage using ESLint scopes (no manual AST crawling).
		// Only count a usage if it occurs inside a custom JSX element (and is not inside a context provider's "value" prop).
		function analyzeVariableUsage(
			declarationId: TSESTree.Identifier
		): Usage {
			const variable = findVariableForIdentifier(declarationId);
			if (!variable) {
				return {
					jsxUsageSet: new Set<TSESTree.JSXElement>(),
					hasOutsideUsage: false
				};
			}

			const jsxUsageSet = new Set<TSESTree.JSXElement>();
			let hasOutsideUsage = false;

			for (const reference of variable.references) {
				const identifier = reference.identifier;

				if (identifier === declarationId) {
					continue;
				}

				// If the identifier is inside a "value" prop on a context-like component, ignore it.
				if (isContextProviderValueProp(identifier)) {
					continue;
				}

				const jsxAncestor = getJSXAncestor(identifier);
				if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
					jsxUsageSet.add(jsxAncestor);
				} else {
					hasOutsideUsage = true;
				}
			}

			return {
				jsxUsageSet,
				hasOutsideUsage
			};
		}

		// Manage hook-derived variables.
		const componentHookVars = new WeakMap<ComponentFunction, Set<string>>();
		function getHookSet(componentFunction: ComponentFunction): Set<string> {
			let hookSet = componentHookVars.get(componentFunction);
			if (!hookSet) {
				hookSet = new Set<string>();
				componentHookVars.set(componentFunction, hookSet);
			}
			return hookSet;
		}

		function hasHookDependency(
			node: TSESTree.Node,
			hookSet: Set<string>
		): boolean {
			if (!node.range) {
				return false;
			}
			const nodeRange = node.range;
			const nodeStart = nodeRange[0];
			const nodeEnd = nodeRange[1];

			let scope: TSESLint.Scope.Scope | null = context.getScope();

			while (scope) {
				for (const variable of scope.variables) {
					if (!hookSet.has(variable.name)) {
						continue;
					}
					for (const reference of variable.references) {
						const identifier = reference.identifier;
						if (!identifier.range) {
							continue;
						}
						const refRange = identifier.range;
						const refStart = refRange[0];
						const refEnd = refRange[1];
						if (refStart >= nodeStart && refEnd <= nodeEnd) {
							return true;
						}
					}
				}
				scope = scope.upper ?? null;
			}

			return false;
		}

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				const componentFunction = getComponentFunction(node);
				if (!componentFunction || !componentFunction.body) return;

				// Record hook-derived variables (for hooks other than useState).
				if (
					node.init &&
					node.id &&
					node.id.type === AST_NODE_TYPES.Identifier &&
					node.init.type === AST_NODE_TYPES.CallExpression &&
					isHookCall(node.init)
				) {
					const hookSet = getHookSet(componentFunction);
					hookSet.add(node.id.name);
				}

				// Case 1: useState destructuring (state & setter).
				if (
					node.init &&
					isUseStateCall(node.init) &&
					node.id.type === AST_NODE_TYPES.ArrayPattern &&
					node.id.elements.length >= 2
				) {
					const stateElem = node.id.elements[0];
					const setterElem = node.id.elements[1];
					if (
						!stateElem ||
						stateElem.type !== AST_NODE_TYPES.Identifier ||
						!setterElem ||
						setterElem.type !== AST_NODE_TYPES.Identifier
					) {
						return;
					}
					const stateVarName = stateElem.name;
					const setterVarName = setterElem.name;

					const stateUsage = analyzeVariableUsage(stateElem);
					const setterUsage = analyzeVariableUsage(setterElem);

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
						setterExclusivelySingleJSX
					) {
						const stateTarget = getSingleSetElement(
							stateUsage.jsxUsageSet
						);
						const setterTarget = getSingleSetElement(
							setterUsage.jsxUsageSet
						);
						if (stateTarget && stateTarget === setterTarget) {
							context.report({
								node: node,
								messageId: "stateAndSetterToChild",
								data: { stateVarName, setterVarName }
							});
						}
					}
				}
				// Case 2: General variable.
				else if (
					node.id &&
					node.id.type === AST_NODE_TYPES.Identifier
				) {
					const varName = node.id.name;
					// Exempt variables that depend on hooks.
					if (node.init) {
						const hookSet = getHookSet(componentFunction);
						if (hasHookDependency(node.init, hookSet)) {
							return;
						}
					}
					const usage = analyzeVariableUsage(node.id);
					// Instead of reporting immediately, add a candidate if the variable is used exclusively in a single custom JSX element.
					if (
						!usage.hasOutsideUsage &&
						usage.jsxUsageSet.size === 1
					) {
						const target = getSingleSetElement(usage.jsxUsageSet);
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
				const groups = new Map<string, CandidateVariable[]>();
				for (const candidate of candidateVariables) {
					const key = candidate.componentName;
					const existing = groups.get(key);
					if (existing) {
						existing.push(candidate);
					} else {
						groups.set(key, [candidate]);
					}
				}
				// Only report candidates for a given component type if there is exactly one candidate.
				for (const candidates of groups.values()) {
					if (candidates.length === 1) {
						const candidate = candidates[0];
						if (!candidate) {
							continue;
						}
						context.report({
							node: candidate.node,
							messageId: "variableToChild",
							data: { varName: candidate.varName }
						});
					}
				}
			}
		};
	}
};
