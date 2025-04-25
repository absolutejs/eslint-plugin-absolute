export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Prefer using logical && operator over ternary with null/undefined for conditional JSX rendering.',
			recommended: false
		},
		messages: {
			useLogicalAnd:
				"Prefer using the logical '&&' operator instead of a ternary with null/undefined for conditional rendering."
		}
	},
	create(context) {
		return {
			ConditionalExpression(node) {
				const alternate = node.alternate;
				// Check if alternate is explicitly null or undefined
				if (
					alternate &&
					((alternate.type === 'Literal' &&
						alternate.value === null) ||
						(alternate.type === 'Identifier' &&
							alternate.name === 'undefined'))
				) {
					// Check if the node is within a JSX expression container.
					if (
						node.parent &&
						node.parent.type === 'JSXExpressionContainer'
					) {
						const containerParent = node.parent.parent;
						// Only flag if the JSXExpressionContainer is used as a child,
						// not as a prop (i.e. not within a JSXAttribute)
						if (
							containerParent &&
							containerParent.type !== 'JSXAttribute'
						) {
							context.report({
								node,
								messageId: 'useLogicalAnd'
							});
						}
					}
				}
			}
		};
	}
};

// TODO : Add a fix function to this rule, it needs a deep unconflicting fix becasue of react/jsx-no-leaked-render, it needs to explicitly be === something like that
