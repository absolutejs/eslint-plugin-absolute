export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				"Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed.",
			category: 'Best Practices',
			recommended: false
		}
	},

	create(context) {
		return {
			JSXElement(node) {
				if (
					node.openingElement.name &&
					node.openingElement.name.name === 'div'
				) {
					const meaningfulChildren = node.children.filter((child) => {
						if (child.type === 'JSXText') {
							return child.value.trim() !== '';
						}
						return true;
					});

					if (
						meaningfulChildren.length === 1 &&
						meaningfulChildren[0].type === 'JSXElement'
					) {
						context.report({
							node,
							message:
								'Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose.'
						});
					}
				}
			}
		};
	}
};
