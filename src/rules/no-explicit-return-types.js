export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects).',
			recommended: false
		},
		schema: [],
		messages: {
			noExplicitReturnType:
				"Explicit return types are disallowed; rely on TypeScript's inference instead."
		}
	},

	create(context) {
		return {
			'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
				node
			) {
				if (node.returnType) {
					// Allow type predicate annotations for type guards.
					const typeAnnotation = node.returnType.typeAnnotation;
					if (
						typeAnnotation &&
						typeAnnotation.type === 'TSTypePredicate'
					) {
						return;
					}

					// Allow if it's an arrow function that directly returns an object literal.
					if (
						node.type === 'ArrowFunctionExpression' &&
						node.expression &&
						node.body &&
						node.body.type === 'ObjectExpression'
					) {
						return;
					}

					// Allow if the function has a block body with a single return statement that returns an object literal.
					if (node.body && node.body.type === 'BlockStatement') {
						const returns = node.body.body.filter(
							(stmt) => stmt.type === 'ReturnStatement'
						);
						if (
							returns.length === 1 &&
							returns[0].argument &&
							returns[0].argument.type === 'ObjectExpression'
						) {
							return;
						}
					}

					// Otherwise, report an error.
					context.report({
						node: node.returnType,
						messageId: 'noExplicitReturnType'
					});
				}
			}
		};
	}
};
