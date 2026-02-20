import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [number?];
type MessageIds = "tooDeep";

export const maxDepthExtended: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		const [option] = context.options;
		const maxDepth = typeof option === "number" ? option : 1;
		const functionStack: number[] = [];

		// Helper to get ancestors of a node by walking its parent chain.
		const getAncestors = (node: TSESTree.Node) => {
			const ancestors: TSESTree.Node[] = [];
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		};

		// Check if a block only contains a single early exit: return or throw.
		const isEarlyExitBlock = (node: TSESTree.BlockStatement) => {
			if (node.body.length !== 1) {
				return false;
			}
			const [first] = node.body;
			if (!first) {
				return false;
			}
			return (
				first.type === "ReturnStatement" ||
				first.type === "ThrowStatement"
			);
		};

		const isFunctionBody = (node: TSESTree.BlockStatement) => {
			const ancestors = getAncestors(node);
			const [parent] = ancestors;
			return (
				parent &&
				(parent.type === "FunctionDeclaration" ||
					parent.type === "FunctionExpression" ||
					parent.type === "ArrowFunctionExpression") &&
				node === parent.body
			);
		};

		const incrementCurrentDepth = () => {
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
		};

		const decrementCurrentDepth = () => {
			if (functionStack.length === 0) {
				return;
			}
			const index = functionStack.length - 1;
			const currentDepth = functionStack[index];
			if (typeof currentDepth !== "number") {
				return;
			}
			functionStack[index] = currentDepth - 1;
		};

		// Report if the current depth exceeds the allowed maximum.
		const checkDepth = (node: TSESTree.BlockStatement, depth: number) => {
			if (depth > maxDepth) {
				context.report({
					data: { depth, maxDepth },
					messageId: "tooDeep",
					node
				});
			}
		};

		return {
			ArrowFunctionExpression() {
				functionStack.push(0);
			},
			"ArrowFunctionExpression:exit"() {
				functionStack.pop();
			},
			BlockStatement(node: TSESTree.BlockStatement) {
				// Do not count if this block is the body of a function.
				if (isFunctionBody(node)) {
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
				if (isFunctionBody(node)) {
					return;
				}

				if (isEarlyExitBlock(node)) {
					return;
				}

				decrementCurrentDepth();
			},
			FunctionDeclaration() {
				functionStack.push(0);
			},
			"FunctionDeclaration:exit"() {
				functionStack.pop();
			},
			FunctionExpression() {
				functionStack.push(0);
			},
			"FunctionExpression:exit"() {
				functionStack.pop();
			}
		};
	},
	defaultOptions: [1],
	meta: {
		docs: {
			description:
				"disallow too many nested blocks except when the block only contains an early exit (return or throw)"
		},
		messages: {
			tooDeep:
				"Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early exit."
		},
		schema: [
			{
				// Accepts a single number as the maximum allowed depth.
				type: "number"
			}
		],
		type: "suggestion"
	}
};
