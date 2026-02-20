/**
 * @fileoverview Disallow the "transition" property in objects typed as CSSProperties.
 *
 * This rule inspects VariableDeclarators where the identifier has a type annotation that
 * includes "CSSProperties" (either as a TSTypeReference or by a text check fallback).
 * It then checks if the initializer is an object literal containing a property named "transition".
 *
 * This is intended to help avoid conflicts with react-spring.
 */

import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "forbiddenTransition";

const getKeyName = (prop: TSESTree.Property) => {
	if (prop.key.type === "Identifier") {
		return prop.key.name;
	}
	if (prop.key.type !== "Literal") {
		return null;
	}
	return typeof prop.key.value === "string"
		? prop.key.value
		: String(prop.key.value);
};

const checkPropForTransition = (
	context: TSESLint.RuleContext<MessageIds, Options>,
	prop: TSESTree.Property
) => {
	if (prop.computed) {
		return;
	}
	const keyName = getKeyName(prop);
	if (keyName === "transition") {
		context.report({
			messageId: "forbiddenTransition",
			node: prop
		});
	}
};

export const noTransitionCSSProperties: TSESLint.RuleModule<
	MessageIds,
	Options
> = {
	create(context) {
		const { sourceCode } = context;

		const isCSSPropertiesType = (typeAnnotation: TSESTree.TypeNode) => {
			if (typeAnnotation.type !== "TSTypeReference") {
				return false;
			}

			const { typeName } = typeAnnotation;

			if (
				typeName.type === "Identifier" &&
				typeName.name === "CSSProperties"
			) {
				return true;
			}

			return (
				typeName.type === "TSQualifiedName" &&
				typeName.right &&
				typeName.right.type === "Identifier" &&
				typeName.right.name === "CSSProperties"
			);
		};

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				// Ensure the variable identifier exists, is an Identifier, and has a type annotation.
				if (
					!node.id ||
					node.id.type !== "Identifier" ||
					!node.id.typeAnnotation
				) {
					return;
				}

				const { typeAnnotation } = node.id.typeAnnotation;

				// Check if the type annotation is CSSProperties
				let isStyleType = isCSSPropertiesType(typeAnnotation);

				// Fallback: if the AST shape doesn't match, check the raw text of the annotation.
				if (!isStyleType) {
					const annotationText = sourceCode.getText(
						node.id.typeAnnotation
					);
					isStyleType = annotationText.includes("CSSProperties");
				}

				if (!isStyleType) {
					return;
				}

				// Check that the initializer is an object literal.
				const { init } = node;
				if (!init || init.type !== "ObjectExpression") {
					return;
				}

				const properties = init.properties.filter(
					(prop): prop is TSESTree.Property =>
						prop.type === "Property"
				);

				properties.forEach((prop) => {
					checkPropForTransition(context, prop);
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
		},
		messages: {
			forbiddenTransition:
				"Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
		},
		schema: [], // no options,
		type: "problem"
	}
};
