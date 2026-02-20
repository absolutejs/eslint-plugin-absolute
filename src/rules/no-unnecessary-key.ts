/**
 * @fileoverview Enforce that the key prop is only used on components
 * rendered as part of an array mapping. This rule disallows having a key prop
 * on a JSX element when it is not part of a mapping, except when the element is
 * returned from a helper render function.
 *
 * Note: This rule does not auto-fix.
 */

import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "unnecessaryKey";

const isMapCallExpression = (node: TSESTree.Node) => {
	if (
		node.type !== "CallExpression" ||
		node.callee.type !== "MemberExpression"
	) {
		return false;
	}

	const { property } = node.callee;
	return (
		(property.type === "Identifier" && property.name === "map") ||
		(property.type === "Literal" && property.value === "map")
	);
};

export const noUnnecessaryKey: TSESLint.RuleModule<MessageIds, Options> = {
	create(context) {
		// Polyfill for context.getAncestors if it's not available.
		const getAncestors = (node: TSESTree.Node) => {
			const ancestors: TSESTree.Node[] = [];
			let current: TSESTree.Node | null | undefined = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		};

		/**
		 * Checks if any of the ancestors is a CallExpression
		 * representing an array mapping.
		 */
		const isInsideMapCall = (ancestors: TSESTree.Node[]) =>
			ancestors.some(isMapCallExpression);

		/**
		 * Checks whether the JSX element is being returned from a helper render
		 * function.
		 */
		const isReturnedFromFunction = (ancestors: TSESTree.Node[]) =>
			ancestors.some((ancestor) => ancestor.type === "ReturnStatement");

		/**
		 * Reports a JSX element if it has a key prop and is not rendered as part
		 * of an inline mapping (and not simply returned from a render helper function).
		 */
		const checkJSXOpeningElement = (node: TSESTree.JSXOpeningElement) => {
			// Find a key attribute.
			const keyAttribute = node.attributes.find(
				(attr) =>
					attr.type === "JSXAttribute" &&
					attr.name.type === "JSXIdentifier" &&
					attr.name.name === "key"
			);

			if (!keyAttribute) {
				return;
			}

			// Retrieve ancestors.
			const ancestors = getAncestors(node);

			// If the element is (directly or indirectly) part of a map call, allow it.
			if (isInsideMapCall(ancestors)) {
				return;
			}

			// If the element is simply returned from a helper function, allow it.
			if (isReturnedFromFunction(ancestors)) {
				return;
			}

			// Otherwise, report the key prop as unnecessary.
			context.report({
				messageId: "unnecessaryKey",
				node: keyAttribute
			});
		};

		return {
			JSXOpeningElement: checkJSXOpeningElement
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"enforce that the key prop is only used on components rendered as part of a mapping"
		},
		messages: {
			unnecessaryKey:
				"The key prop should only be used on elements that are directly rendered as part of an array mapping."
		},
		schema: [],
		type: "problem"
	}
};
