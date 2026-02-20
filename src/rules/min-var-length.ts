import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MinVarLengthOption = {
	minLength?: number;
	allowedVars?: string[];
};

type Options = [MinVarLengthOption?];
type MessageIds = "variableNameTooShort";

export const minVarLength: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow variable names shorter than the configured minimum length unless an outer variable with a longer name starting with the same characters exists. You can exempt specific variable names using the allowedVars option."
		},
		schema: [
			{
				type: "object",
				properties: {
					minLength: {
						type: "number",
						default: 1
					},
					allowedVars: {
						type: "array",
						items: {
							type: "string",
							minLength: 1
							// Note: The maxLength for each string should be at most the configured minLength.
						},
						default: []
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			variableNameTooShort:
				"Variable '{{name}}' is too short. Minimum allowed length is {{minLength}} characters unless an outer variable with a longer name starting with '{{name}}' exists."
		}
	},

	defaultOptions: [{}],

	create(context) {
		const sourceCode = context.sourceCode;
		const options = context.options[0];
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
		function getAncestors(node: TSESTree.Node) {
			const ancestors: TSESTree.Node[] = [];
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		}

		// Helper: retrieve the scope for a given node using the scopeManager.
		function getScope(node: TSESTree.Node): TSESLint.Scope.Scope | null {
			const scopeManager = sourceCode.scopeManager;
			if (!scopeManager) {
				return null;
			}
			const acquired = scopeManager.acquire(node);
			if (acquired) {
				return acquired;
			}
			return scopeManager.globalScope ?? null;
		}

		// Fallback: get declared variable names in the nearest BlockStatement.
		function getVariablesInNearestBlock(node: TSESTree.Node) {
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current && current.type !== "BlockStatement") {
				current = current.parent;
			}
			const names: string[] = [];
			if (
				current &&
				current.type === "BlockStatement" &&
				Array.isArray(current.body)
			) {
				for (const stmt of current.body) {
					if (stmt.type === "VariableDeclaration") {
						for (const decl of stmt.declarations) {
							if (decl.id && decl.id.type === "Identifier") {
								names.push(decl.id.name);
							}
						}
					}
				}
			}
			return names;
		}

		/**
		 * Recursively extract identifier names from a pattern (for destructuring)
		 * @param {ASTNode} pattern The pattern node.
		 * @param {string[]} identifiers Array to accumulate names.
		 * @returns {string[]} Array of identifier names.
		 */
		function extractIdentifiersFromPattern(
			pattern: TSESTree.Node | null,
			identifiers: string[] = []
		): string[] {
			if (!pattern) return identifiers;
			switch (pattern.type) {
				case "Identifier":
					identifiers.push(pattern.name);
					break;
				case "ObjectPattern":
					for (const prop of pattern.properties) {
						if (prop.type === "Property") {
							extractIdentifiersFromPattern(
								prop.value,
								identifiers
							);
						} else if (prop.type === "RestElement") {
							extractIdentifiersFromPattern(
								prop.argument,
								identifiers
							);
						}
					}
					break;
				case "ArrayPattern":
					for (const element of pattern.elements) {
						if (element) {
							extractIdentifiersFromPattern(element, identifiers);
						}
					}
					break;
				case "AssignmentPattern":
					extractIdentifiersFromPattern(pattern.left, identifiers);
					break;
				default:
					break;
			}
			return identifiers;
		}

		/**
		 * Checks if there is an outer variable whose name is longer than the current short name
		 * and starts with the same characters.
		 * It first uses the scope manager; if that doesn’t yield a match,
		 * it falls back on scanning the nearest block and ancestors.
		 * @param {string} shortName The variable name that is shorter than minLength.
		 * @param {ASTNode} node The current identifier node.
		 * @returns {boolean} True if an outer variable is found.
		 */
		function hasOuterCorrespondingIdentifier(
			shortName: string,
			node: TSESTree.Identifier
		) {
			// First, try using the scope manager.
			const startingScope = getScope(node);
			let outer =
				startingScope && startingScope.upper
					? startingScope.upper
					: null;
			while (outer) {
				for (const variable of outer.variables) {
					if (
						variable.name.length >= minLength &&
						variable.name.length > shortName.length &&
						variable.name.startsWith(shortName)
					) {
						return true;
					}
				}
				outer = outer.upper;
			}
			// Fallback: scan the nearest BlockStatement.
			const blockVars = getVariablesInNearestBlock(node);
			for (const name of blockVars) {
				if (
					name.length >= minLength &&
					name.length > shortName.length &&
					name.startsWith(shortName)
				) {
					return true;
				}
			}
			// Fallback: scan ancestors.
			const ancestors = getAncestors(node);
			for (const anc of ancestors) {
				if (
					anc.type === "VariableDeclarator" &&
					anc.id &&
					anc.id.type === "Identifier"
				) {
					const outerName = anc.id.name;
					if (
						outerName.length >= minLength &&
						outerName.length > shortName.length &&
						outerName.startsWith(shortName)
					) {
						return true;
					}
				}
				if (
					(anc.type === "FunctionDeclaration" ||
						anc.type === "FunctionExpression" ||
						anc.type === "ArrowFunctionExpression") &&
					Array.isArray(anc.params)
				) {
					for (const param of anc.params) {
						const names = extractIdentifiersFromPattern(param, []);
						for (const n of names) {
							if (
								n.length >= minLength &&
								n.length > shortName.length &&
								n.startsWith(shortName)
							) {
								return true;
							}
						}
					}
				}
				if (anc.type === "CatchClause" && anc.param) {
					const names = extractIdentifiersFromPattern(anc.param, []);
					for (const n of names) {
						if (
							n.length >= minLength &&
							n.length > shortName.length &&
							n.startsWith(shortName)
						) {
							return true;
						}
					}
				}
			}
			return false;
		}

		/**
		 * Checks an Identifier node. If its name is shorter than minLength (and not in the allowed list)
		 * and no outer variable with a longer name starting with the short name is found, it reports an error.
		 * @param {ASTNode} node The Identifier node.
		 */
		function checkIdentifier(node: TSESTree.Identifier) {
			const name = node.name;
			if (name.length < minLength) {
				// If the name is in the allowed list, skip.
				if (allowedVars.includes(name)) {
					return;
				}
				if (!hasOuterCorrespondingIdentifier(name, node)) {
					context.report({
						node,
						messageId: "variableNameTooShort",
						data: { name, minLength }
					});
				}
			}
		}

		/**
		 * Recursively checks a pattern node for identifiers.
		 * @param {ASTNode} pattern The pattern node.
		 */
		function checkPattern(pattern: TSESTree.Node | null) {
			if (!pattern) return;
			switch (pattern.type) {
				case "Identifier":
					checkIdentifier(pattern);
					break;
				case "ObjectPattern":
					for (const prop of pattern.properties) {
						if (prop.type === "Property") {
							checkPattern(prop.value);
						} else if (prop.type === "RestElement") {
							checkPattern(prop.argument);
						}
					}
					break;
				case "ArrayPattern":
					for (const element of pattern.elements) {
						if (element) {
							checkPattern(element);
						}
					}
					break;
				case "AssignmentPattern":
					checkPattern(pattern.left);
					break;
				default:
					break;
			}
		}

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (node.id) {
					checkPattern(node.id);
				}
			},
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
				node:
					| TSESTree.FunctionDeclaration
					| TSESTree.FunctionExpression
					| TSESTree.ArrowFunctionExpression
			) {
				for (const param of node.params) {
					checkPattern(param);
				}
			},
			CatchClause(node: TSESTree.CatchClause) {
				if (node.param) {
					checkPattern(node.param);
				}
			}
		};
	}
};
