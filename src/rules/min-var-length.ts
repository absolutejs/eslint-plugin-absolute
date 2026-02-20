import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MinVarLengthOption = {
	minLength?: number;
	allowedVars?: string[];
};

type Options = [MinVarLengthOption?];
type MessageIds = "variableNameTooShort";

/**
 * Recursively extract identifier names from a pattern (for destructuring)
 */
const extractIdentifiersFromPattern = (
	pattern: TSESTree.Node | null,
	identifiers: string[] = []
) => {
	if (!pattern) return identifiers;
	switch (pattern.type) {
		case "Identifier":
			identifiers.push(pattern.name);
			break;
		case "ObjectPattern":
			pattern.properties.forEach((prop) => {
				if (prop.type === "Property") {
					extractIdentifiersFromPattern(prop.value, identifiers);
				} else if (prop.type === "RestElement") {
					extractIdentifiersFromPattern(prop.argument, identifiers);
				}
			});
			break;
		case "ArrayPattern":
			pattern.elements
				.filter(
					(element): element is TSESTree.DestructuringPattern =>
						element !== null
				)
				.forEach((element) => {
					extractIdentifiersFromPattern(element, identifiers);
				});
			break;
		case "AssignmentPattern":
			extractIdentifiersFromPattern(pattern.left, identifiers);
			break;
		default:
			break;
	}
	return identifiers;
};

const getDeclaratorNames = (declarations: TSESTree.VariableDeclarator[]) =>
	declarations
		.filter(
			(
				decl
			): decl is TSESTree.VariableDeclarator & {
				id: TSESTree.Identifier;
			} => decl.id.type === "Identifier"
		)
		.map((decl) => decl.id.name);

const collectParamNames = (params: TSESTree.Parameter[]) => {
	const names: string[] = [];
	params.forEach((param) => {
		extractIdentifiersFromPattern(param, names);
	});
	return names;
};

export const minVarLength: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const { sourceCode } = context;
		const [options] = context.options;
		const configuredMinLength =
			options && typeof options.minLength === "number"
				? options.minLength
				: 1;
		const configuredAllowedVars =
			options && Array.isArray(options.allowedVars)
				? options.allowedVars
				: [];

		const minLength = configuredMinLength;
		const allowedVars = configuredAllowedVars;

		// Helper: walk up the node.parent chain to get ancestors.
		const getAncestors = (node: TSESTree.Node) => {
			const ancestors: TSESTree.Node[] = [];
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		};

		// Helper: retrieve the scope for a given node using the scopeManager.
		const getScope = (node: TSESTree.Node) => {
			const { scopeManager } = sourceCode;
			if (!scopeManager) {
				return null;
			}
			const acquired = scopeManager.acquire(node);
			if (acquired) {
				return acquired;
			}
			return scopeManager.globalScope ?? null;
		};

		// Fallback: get declared variable names in the nearest BlockStatement.
		const getVariablesInNearestBlock = (node: TSESTree.Node) => {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current && current.type !== "BlockStatement") {
				current = current.parent;
			}
			if (
				!current ||
				current.type !== "BlockStatement" ||
				!Array.isArray(current.body)
			) {
				return [];
			}

			const varDeclarations = current.body.filter(
				(stmt): stmt is TSESTree.VariableDeclaration =>
					stmt.type === "VariableDeclaration"
			);
			return varDeclarations.flatMap((stmt) =>
				getDeclaratorNames(stmt.declarations)
			);
		};

		const isLongerMatchInScope = (shortName: string, varName: string) =>
			varName.length >= minLength &&
			varName.length > shortName.length &&
			varName.startsWith(shortName);

		const checkScopeVariables = (
			shortName: string,
			node: TSESTree.Identifier
		) => {
			const startingScope = getScope(node);
			let outer =
				startingScope && startingScope.upper
					? startingScope.upper
					: null;
			while (outer) {
				if (
					outer.variables.some((variable) =>
						isLongerMatchInScope(shortName, variable.name)
					)
				) {
					return true;
				}
				outer = outer.upper;
			}
			return false;
		};

		const checkBlockVariables = (
			shortName: string,
			node: TSESTree.Identifier
		) => {
			const blockVars = getVariablesInNearestBlock(node);
			return blockVars.some((varName) =>
				isLongerMatchInScope(shortName, varName)
			);
		};

		const checkAncestorDeclarators = (
			shortName: string,
			node: TSESTree.Identifier
		) => {
			const ancestors = getAncestors(node);
			return ancestors.some(
				(anc) =>
					anc.type === "VariableDeclarator" &&
					anc.id &&
					anc.id.type === "Identifier" &&
					isLongerMatchInScope(shortName, anc.id.name)
			);
		};

		const checkFunctionAncestor = (
			shortName: string,
			anc:
				| TSESTree.FunctionDeclaration
				| TSESTree.FunctionExpression
				| TSESTree.ArrowFunctionExpression
		) => {
			const names = collectParamNames(anc.params);
			return names.some((paramName) =>
				isLongerMatchInScope(shortName, paramName)
			);
		};

		const checkCatchAncestor = (
			shortName: string,
			anc: TSESTree.CatchClause
		) => {
			if (!anc.param) {
				return false;
			}
			const names = extractIdentifiersFromPattern(anc.param, []);
			return names.some((paramName) =>
				isLongerMatchInScope(shortName, paramName)
			);
		};

		const checkAncestorParams = (
			shortName: string,
			node: TSESTree.Identifier
		) => {
			const ancestors = getAncestors(node);
			return ancestors.some((anc) => {
				if (
					anc.type === "FunctionDeclaration" ||
					anc.type === "FunctionExpression" ||
					anc.type === "ArrowFunctionExpression"
				) {
					return checkFunctionAncestor(shortName, anc);
				}
				if (anc.type === "CatchClause") {
					return checkCatchAncestor(shortName, anc);
				}
				return false;
			});
		};

		/**
		 * Checks if there is an outer variable whose name is longer than the current short name
		 * and starts with the same characters.
		 */
		const hasOuterCorrespondingIdentifier = (
			shortName: string,
			node: TSESTree.Identifier
		) =>
			checkScopeVariables(shortName, node) ||
			checkBlockVariables(shortName, node) ||
			checkAncestorDeclarators(shortName, node) ||
			checkAncestorParams(shortName, node);

		/**
		 * Checks an Identifier node. If its name is shorter than minLength (and not in the allowed list)
		 * and no outer variable with a longer name starting with the short name is found, it reports an error.
		 */
		const checkIdentifier = (node: TSESTree.Identifier) => {
			const { name } = node;
			if (name.length >= minLength) {
				return;
			}

			// If the name is in the allowed list, skip.
			if (allowedVars.includes(name)) {
				return;
			}
			if (!hasOuterCorrespondingIdentifier(name, node)) {
				context.report({
					data: { minLength, name },
					messageId: "variableNameTooShort",
					node
				});
			}
		};

		/**
		 * Recursively checks a pattern node for identifiers.
		 */
		const checkPattern = (pattern: TSESTree.Node | null) => {
			if (!pattern) return;
			switch (pattern.type) {
				case "Identifier":
					checkIdentifier(pattern);
					break;
				case "ObjectPattern":
					pattern.properties.forEach((prop) => {
						if (prop.type === "Property") {
							checkPattern(prop.value);
						} else if (prop.type === "RestElement") {
							checkPattern(prop.argument);
						}
					});
					break;
				case "ArrayPattern":
					pattern.elements
						.filter(
							(
								element
							): element is TSESTree.DestructuringPattern =>
								element !== null
						)
						.forEach((element) => {
							checkPattern(element);
						});
					break;
				case "AssignmentPattern":
					checkPattern(pattern.left);
					break;
				default:
					break;
			}
		};

		return {
			CatchClause(node: TSESTree.CatchClause) {
				if (node.param) {
					checkPattern(node.param);
				}
			},
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node:
					| TSESTree.FunctionDeclaration
					| TSESTree.FunctionExpression
					| TSESTree.ArrowFunctionExpression
			) {
				node.params.forEach((param) => {
					checkPattern(param);
				});
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (node.id) {
					checkPattern(node.id);
				}
			}
		};
	},
	defaultOptions: [{}],
	meta: {
		docs: {
			description:
				"Disallow variable names shorter than the configured minimum length unless an outer variable with a longer name starting with the same characters exists. You can exempt specific variable names using the allowedVars option."
		},
		messages: {
			variableNameTooShort:
				"Variable '{{name}}' is too short. Minimum allowed length is {{minLength}} characters unless an outer variable with a longer name starting with '{{name}}' exists."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowedVars: {
						default: [],
						items: {
							minLength: 1,
							type: "string"
							// Note: The maxLength for each string should be at most the configured minLength.
						},
						type: "array"
					},
					minLength: {
						default: 1,
						type: "number"
					}
				},
				type: "object"
			}
		],
		type: "problem"
	}
};
