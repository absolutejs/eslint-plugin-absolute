/**
 * @fileoverview Disallow the "transition" property in objects typed as CSSProperties.
 *
 * This rule inspects VariableDeclarators where the identifier has a type annotation that
 * includes "CSSProperties" (either as a TSTypeReference or by a text check fallback).
 * It then checks if the initializer is an object literal containing a property named "transition".
 *
 * This is intended to help avoid conflicts with react-spring.
 */

export default {
	meta: {
		type: 'problem',
		docs: {
			description:
				"Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring.",
			recommended: false
		},
		schema: [],
		messages: {
			forbiddenTransition:
				"Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
		}
	},

	create(context) {
		const sourceCode = context.getSourceCode();
		return {
			VariableDeclarator(node) {
				// Ensure the variable identifier exists, is an Identifier, and has a type annotation.
				if (
					!node.id ||
					node.id.type !== 'Identifier' ||
					!node.id.typeAnnotation
				) {
					return;
				}
				let isStyleType = false;
				const typeAnnotation = node.id.typeAnnotation.typeAnnotation;

				// First try: check if it's a TSTypeReference with typeName "CSSProperties"
				if (
					typeAnnotation &&
					typeAnnotation.type === 'TSTypeReference'
				) {
					const { typeName } = typeAnnotation;
					if (
						typeName.type === 'Identifier' &&
						typeName.name === 'CSSProperties'
					) {
						isStyleType = true;
					} else if (
						typeName.type === 'TSQualifiedName' &&
						typeName.right &&
						typeName.right.name === 'CSSProperties'
					) {
						isStyleType = true;
					}
				}

				// Fallback: if the AST shape doesn't match, check the raw text of the annotation.
				if (!isStyleType) {
					const annotationText = sourceCode.getText(
						node.id.typeAnnotation
					);
					if (annotationText.includes('CSSProperties')) {
						isStyleType = true;
					}
				}

				if (!isStyleType) {
					return;
				}

				// Check that the initializer is an object literal.
				if (node.init && node.init.type === 'ObjectExpression') {
					node.init.properties.forEach((prop) => {
						// Only consider regular properties.
						if (prop.type !== 'Property') {
							return;
						}
						if (prop.computed) {
							return;
						}
						let keyName = null;
						if (prop.key.type === 'Identifier') {
							keyName = prop.key.name;
						} else if (prop.key.type === 'Literal') {
							keyName = String(prop.key.value);
						}
						if (keyName === 'transition') {
							context.report({
								node: prop,
								messageId: 'forbiddenTransition'
							});
						}
					});
				}
			}
		};
	}
};
