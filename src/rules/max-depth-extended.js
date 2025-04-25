export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'disallow too many nested blocks except when the block only contains an early return',
			category: 'Best Practices',
			recommended: false
		},
		schema: [
			{
				// Accepts a single number as the maximum allowed depth.
				type: 'number'
			}
		]
	},
	create(context) {
		const maxDepth =
			typeof context.options[0] === 'number' ? context.options[0] : 1;
		const functionStack = [];

		// Helper to get ancestors of a node by walking its parent chain.
		function getAncestors(node) {
			const ancestors = [];
			let current = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		}

		// Check if a block only contains a single return statement.
		function isEarlyReturnBlock(node) {
			return (
				node.body.length === 1 &&
				node.body[0].type === 'ReturnStatement'
			);
		}

		// Report if the current depth exceeds the allowed maximum.
		function checkDepth(node, depth) {
			if (depth > maxDepth) {
				context.report({
					node,
					message:
						'Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early return.',
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
			BlockStatement(node) {
				const ancestors = getAncestors(node);
				const parent = ancestors[0];
				// Do not count if this block is the body of a function.
				if (
					parent &&
					(parent.type === 'FunctionDeclaration' ||
						parent.type === 'FunctionExpression' ||
						parent.type === 'ArrowFunctionExpression') &&
					node === parent.body
				) {
					return;
				}
				// Skip blocks that only have an early return.
				if (isEarlyReturnBlock(node)) {
					return;
				}
				if (functionStack.length > 0) {
					functionStack[functionStack.length - 1]++;
					checkDepth(node, functionStack[functionStack.length - 1]);
				}
			},
			'BlockStatement:exit'(node) {
				const ancestors = getAncestors(node);
				const parent = ancestors[0];
				if (
					parent &&
					(parent.type === 'FunctionDeclaration' ||
						parent.type === 'FunctionExpression' ||
						parent.type === 'ArrowFunctionExpression') &&
					node === parent.body
				) {
					return;
				}
				if (isEarlyReturnBlock(node)) {
					return;
				}
				if (functionStack.length > 0) {
					functionStack[functionStack.length - 1]--;
				}
			},
			'FunctionDeclaration:exit'() {
				functionStack.pop();
			},
			'FunctionExpression:exit'() {
				functionStack.pop();
			},
			'ArrowFunctionExpression:exit'() {
				functionStack.pop();
			}
		};
	}
};
