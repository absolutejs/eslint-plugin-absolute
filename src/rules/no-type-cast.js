export default {
	meta: {
		type: "problem",
		docs: {
			description:
				'Disallow type assertions using "as", angle bracket syntax, or built-in conversion functions.',
			recommended: false
		},
		schema: []
	},
	create(context) {
		// Helper function to determine if a call expression is a built-in conversion.
		function isBuiltInConversion(node) {
			return (
				node &&
				node.type === "Identifier" &&
				["Number", "String", "Boolean"].includes(node.name)
			);
		}

		return {
			// Catch type assertions using "as" syntax.
			TSAsExpression(node) {
				context.report({
					node,
					message:
						'Type assertions using "as" syntax are not allowed.'
				});
			},
			// Catch type assertions using angle bracket syntax.
			TSTypeAssertion(node) {
				context.report({
					node,
					message:
						"Type assertions using angle bracket syntax are not allowed."
				});
			},
			// Catch type conversions using built-in functions like Number(prop)
			CallExpression(node) {
				// Check if the callee is a built-in conversion function.
				if (isBuiltInConversion(node.callee)) {
					context.report({
						node,
						message: `Type assertions using "${node.callee.name}()" syntax are not allowed.`
					});
				}
			}
		};
	}
};
