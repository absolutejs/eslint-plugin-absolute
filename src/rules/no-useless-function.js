export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring).',
			category: 'Best Practices',
			recommended: false
		},
		fixable: null
	},
	create(context) {
		function isCallbackFunction(node) {
			// Check if the node is an argument of a CallExpression
			return (
				node.parent &&
				node.parent.type === 'CallExpression' &&
				node.parent.arguments.includes(node)
			);
		}

		return {
			ArrowFunctionExpression(node) {
				// Check for functions with no parameters and a body that's an ObjectExpression
				if (
					node.params.length === 0 &&
					node.body &&
					node.body.type === 'ObjectExpression'
				) {
					// If the function is used as a callback (like in react-spring), skip reporting.
					if (isCallbackFunction(node)) {
						return;
					}
					context.report({
						node,
						message:
							'This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function.'
					});
				}
			}
		};
	}
};
