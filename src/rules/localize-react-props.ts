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
	create(context) {
		// A list of candidate variables for reporting (for general variables only).
		const candidateVariables: CandidateVariable[] = [];

		const getSingleSetElement = <T>(set: Set<T>) => {
			for (const value of set) {
				return value;
			}
			return null;
		};

		const getRightmostJSXIdentifier = (
			name: TSESTree.JSXTagNameExpression
		) => {
			let current: TSESTree.JSXTagNameExpression = name;
			while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
				current = current.property;
			}
			if (current.type === AST_NODE_TYPES.JSXIdentifier) {
				return current;
			}
			return null;
		};

		const getLeftmostJSXIdentifier = (
			name: TSESTree.JSXTagNameExpression
		) => {
			let current: TSESTree.JSXTagNameExpression = name;
			while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
				current = current.object;
			}
			if (current.type === AST_NODE_TYPES.JSXIdentifier) {
				return current;
			}
			return null;
		};

		// Helper: Extract the component name from a JSXElement.
		const getJSXElementName = (jsxElement: TSESTree.JSXElement | null) => {
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
		};

		// Helper: Check if the node is a call to useState.
		const isUseStateCall = (
			node: TSESTree.Node | null
		): node is TSESTree.CallExpression =>
			node !== null &&
			node.type === AST_NODE_TYPES.CallExpression &&
			node.callee !== null &&
			((node.callee.type === AST_NODE_TYPES.Identifier &&
				node.callee.name === "useState") ||
				(node.callee.type === AST_NODE_TYPES.MemberExpression &&
					node.callee.property !== null &&
					node.callee.property.type === AST_NODE_TYPES.Identifier &&
					node.callee.property.name === "useState"));

		// Helper: Check if a call expression is a hook call (other than useState).
		const isHookCall = (
			node: TSESTree.Node | null
		): node is TSESTree.CallExpression =>
			node !== null &&
			node.type === AST_NODE_TYPES.CallExpression &&
			node.callee !== null &&
			node.callee.type === AST_NODE_TYPES.Identifier &&
			/^use[A-Z]/.test(node.callee.name) &&
			node.callee.name !== "useState";

		// Helper: Walk upward to find the closest JSXElement ancestor.
		const getJSXAncestor = (node: TSESTree.Node) => {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				if (current.type === AST_NODE_TYPES.JSXElement) {
					return current;
				}
				current = current.parent;
			}
			return null;
		};

		const getTagNameFromOpening = (
			openingElement: TSESTree.JSXOpeningElement
		) => {
			const nameNode = openingElement.name;
			if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
				return nameNode.name;
			}
			const rightmost = getRightmostJSXIdentifier(nameNode);
			return rightmost ? rightmost.name : null;
		};

		const isProviderOrContext = (tagName: string) =>
			tagName.endsWith("Provider") || tagName.endsWith("Context");

		const isValueAttributeOnProvider = (node: TSESTree.Node) =>
			node.type === AST_NODE_TYPES.JSXAttribute &&
			node.name &&
			node.name.type === AST_NODE_TYPES.JSXIdentifier &&
			node.name.name === "value" &&
			node.parent &&
			node.parent.type === AST_NODE_TYPES.JSXOpeningElement &&
			(() => {
				const tagName = getTagNameFromOpening(node.parent);
				return tagName !== null && isProviderOrContext(tagName);
			})();

		// Helper: Check whether the given node is inside a JSXAttribute "value"
		// that belongs to a context-like component (i.e. tag name ends with Provider or Context).
		const isContextProviderValueProp = (node: TSESTree.Node) => {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				if (isValueAttributeOnProvider(current)) {
					return true;
				}
				current = current.parent;
			}
			return false;
		};

		// Helper: Determine if a JSXElement is a custom component (tag name begins with an uppercase letter).
		const isCustomJSXElement = (jsxElement: TSESTree.JSXElement | null) => {
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
			return leftmost !== null && /^[A-Z]/.test(leftmost.name);
		};

		// Helper: Find the nearest enclosing function (assumed to be the component).
		const getComponentFunction = (node: TSESTree.Node | null) => {
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
		};

		const findVariableForIdentifier = (identifier: TSESTree.Identifier) => {
			let scope: TSESLint.Scope.Scope | null =
				context.sourceCode.getScope(identifier);
			while (scope) {
				const found = scope.variables.find((variable) =>
					variable.defs.some((def) => def.name === identifier)
				);
				if (found) {
					return found;
				}
				scope = scope.upper ?? null;
			}
			return null;
		};

		// Analyze variable usage using ESLint scopes (no manual AST crawling).
		// Only count a usage if it occurs inside a custom JSX element (and is not inside a context provider's "value" prop).
		const classifyReference = (
			reference: TSESLint.Scope.Reference,
			declarationId: TSESTree.Identifier,
			jsxUsageSet: Set<TSESTree.JSXElement>
		) => {
			const { identifier } = reference;

			if (
				identifier === declarationId ||
				isContextProviderValueProp(identifier)
			) {
				return false;
			}

			const jsxAncestor = getJSXAncestor(identifier);
			if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
				jsxUsageSet.add(jsxAncestor);
				return false;
			}
			return true;
		};

		const analyzeVariableUsage = (
			declarationId: TSESTree.Identifier
		): Usage => {
			const variable = findVariableForIdentifier(declarationId);
			if (!variable) {
				return {
					hasOutsideUsage: false,
					jsxUsageSet: new Set<TSESTree.JSXElement>()
				};
			}

			const jsxUsageSet = new Set<TSESTree.JSXElement>();
			const hasOutsideUsage = variable.references.some((ref) =>
				classifyReference(ref, declarationId, jsxUsageSet)
			);

			return {
				hasOutsideUsage,
				jsxUsageSet
			};
		};

		// Manage hook-derived variables.
		const componentHookVars = new WeakMap<ComponentFunction, Set<string>>();
		const getHookSet = (componentFunction: ComponentFunction) => {
			let hookSet = componentHookVars.get(componentFunction);
			if (!hookSet) {
				hookSet = new Set<string>();
				componentHookVars.set(componentFunction, hookSet);
			}
			return hookSet;
		};

		const isRangeContained = (
			refRange: [number, number],
			nodeRange: [number, number]
		) => refRange[0] >= nodeRange[0] && refRange[1] <= nodeRange[1];

		const variableHasReferenceInRange = (
			variable: TSESLint.Scope.Variable,
			nodeRange: [number, number]
		) =>
			variable.references.some(
				(reference) =>
					reference.identifier.range !== undefined &&
					isRangeContained(reference.identifier.range, nodeRange)
			);

		const hasHookDependency = (
			node: TSESTree.Node,
			hookSet: Set<string>
		) => {
			if (!node.range) {
				return false;
			}
			const nodeRange = node.range;

			let scope: TSESLint.Scope.Scope | null =
				context.sourceCode.getScope(node);

			while (scope) {
				const hookVars = scope.variables.filter((variable) =>
					hookSet.has(variable.name)
				);
				if (
					hookVars.some((variable) =>
						variableHasReferenceInRange(variable, nodeRange)
					)
				) {
					return true;
				}
				scope = scope.upper ?? null;
			}

			return false;
		};

		const processUseStateDeclarator = (
			node: TSESTree.VariableDeclarator
		) => {
			if (
				!node.init ||
				!isUseStateCall(node.init) ||
				node.id.type !== AST_NODE_TYPES.ArrayPattern ||
				node.id.elements.length < 2
			) {
				return false;
			}

			const [stateElem, setterElem] = node.id.elements;
			if (
				!stateElem ||
				stateElem.type !== AST_NODE_TYPES.Identifier ||
				!setterElem ||
				setterElem.type !== AST_NODE_TYPES.Identifier
			) {
				return false;
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

			if (!stateExclusivelySingleJSX || !setterExclusivelySingleJSX) {
				return true;
			}

			const stateTarget = getSingleSetElement(stateUsage.jsxUsageSet);
			const setterTarget = getSingleSetElement(setterUsage.jsxUsageSet);
			if (stateTarget && stateTarget === setterTarget) {
				context.report({
					data: { setterVarName, stateVarName },
					messageId: "stateAndSetterToChild",
					node: node
				});
			}
			return true;
		};

		const processGeneralVariable = (
			node: TSESTree.VariableDeclarator,
			componentFunction: ComponentFunction
		) => {
			if (!node.id || node.id.type !== AST_NODE_TYPES.Identifier) {
				return;
			}

			const varName = node.id.name;
			// Exempt variables that depend on hooks.
			if (node.init) {
				const hookSet = getHookSet(componentFunction);
				if (hasHookDependency(node.init, hookSet)) {
					return;
				}
			}
			const usage = analyzeVariableUsage(node.id);
			if (!usage.hasOutsideUsage && usage.jsxUsageSet.size === 1) {
				const target = getSingleSetElement(usage.jsxUsageSet);
				const componentName = getJSXElementName(target);
				candidateVariables.push({
					componentName,
					node,
					varName
				});
			}
		};

		return {
			// At the end of the traversal, group candidate variables by the target component name.
			"Program:exit"() {
				const groups = new Map<string, CandidateVariable[]>();
				candidateVariables.forEach((candidate) => {
					const key = candidate.componentName;
					const existing = groups.get(key);
					if (existing) {
						existing.push(candidate);
					} else {
						groups.set(key, [candidate]);
					}
				});
				// Only report candidates for a given component type if there is exactly one candidate.
				groups.forEach((candidates) => {
					if (candidates.length !== 1) {
						return;
					}
					const [candidate] = candidates;
					if (!candidate) {
						return;
					}
					context.report({
						data: { varName: candidate.varName },
						messageId: "variableToChild",
						node: candidate.node
					});
				});
			},
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
				const wasUseState = processUseStateDeclarator(node);

				// Case 2: General variable.
				if (!wasUseState) {
					processGeneralVariable(node, componentFunction);
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate – if two or more are passed to the same component type, they're assumed to be settings that belong on the parent."
		},
		messages: {
			stateAndSetterToChild:
				"State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
			variableToChild:
				"Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component."
		},
		schema: [],
		type: "suggestion"
	}
};
