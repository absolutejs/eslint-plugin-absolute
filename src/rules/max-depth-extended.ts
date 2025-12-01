import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [number?];
type MessageIds = "tooDeep";

export const maxDepthExtended: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"disallow too many nested blocks except when the block only contains an early exit (return or throw)"
		},
		schema: [
			{
				// Accepts a single number as the maximum allowed depth.
				type: "number"
			}
		],
		messages: {
			tooDeep:
				"Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early exit."
		}
	},

	defaultOptions: [1],

	create(context) {
		const option = context.options[0];
		const maxDepth = typeof option === "number" ? option : 1;
		const functionStack: number[] = [];

		// Helper to get ancestors of a node by walking its parent chain.
		function getAncestors(node: TSESTree.Node) {
			const ancestors: TSESTree.Node[] = [];
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		}

		// Check if a block only contains a single early exit: return or throw.
		function isEarlyExitBlock(node: TSESTree.BlockStatement) {
			if (node.body.length !== 1) {
				return false;
			}
			const first = node.body[0];
			if (!first) {
				return false;
			}
			return (
				first.type === "ReturnStatement" ||
				first.type === "ThrowStatement"
			);
		}

		function incrementCurrentDepth(): number | null {
			if (functionStack.length === 0) {
				return null;
			}
			const index = functionStack.length - 1;
			const currentDepth = functionStack[index];
			if (typeof currentDepth !== "number") {
				return null;
			}
			const nextDepth = currentDepth + 1;
			functionStack[index] = nextDepth;
			return nextDepth;
		}

		function decrementCurrentDepth(): void {
			if (functionStack.length === 0) {
				return;
			}
			const index = functionStack.length - 1;
			const currentDepth = functionStack[index];
			if (typeof currentDepth !== "number") {
				return;
			}
			functionStack[index] = currentDepth - 1;
		}

		// Report if the current depth exceeds the allowed maximum.
		function checkDepth(node: TSESTree.BlockStatement, depth: number) {
			if (depth > maxDepth) {
				context.report({
					node,
					messageId: "tooDeep",
					data: { depth, maxDepth }
				});
			}
		}

		return {
			FunctionDeclaration() {
				functionStack.push(0);
			},
			FunctionExpression() {
				functionStack.push(0);
			},
			ArrowFunctionExpression() {
				functionStack.push(0);
			},

			BlockStatement(node: TSESTree.BlockStatement) {
				const ancestors = getAncestors(node);
				const parent = ancestors.length > 0 ? ancestors[0] : undefined;

				// Do not count if this block is the body of a function.
				if (
					parent &&
					(parent.type === "FunctionDeclaration" ||
						parent.type === "FunctionExpression" ||
						parent.type === "ArrowFunctionExpression") &&
					node === parent.body
				) {
					return;
				}

				// Skip blocks that only have an early exit.
				if (isEarlyExitBlock(node)) {
					return;
				}

				const depth = incrementCurrentDepth();
				if (depth !== null) {
					checkDepth(node, depth);
				}
			},

			"BlockStatement:exit"(node: TSESTree.BlockStatement) {
				const ancestors = getAncestors(node);
				const parent = ancestors.length > 0 ? ancestors[0] : undefined;

				if (
					parent &&
					(parent.type === "FunctionDeclaration" ||
						parent.type === "FunctionExpression" ||
						parent.type === "ArrowFunctionExpression") &&
					node === parent.body
				) {
					return;
				}

				if (isEarlyExitBlock(node)) {
					return;
				}

				decrementCurrentDepth();
			},

			"FunctionDeclaration:exit"() {
				functionStack.pop();
			},
			"FunctionExpression:exit"() {
				functionStack.pop();
			},
			"ArrowFunctionExpression:exit"() {
				functionStack.pop();
			}
		};
	}
};
