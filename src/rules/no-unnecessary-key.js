/**
 * @fileoverview Enforce that the key prop is only used on components
 * rendered as part of an array mapping. This rule disallows having a key prop
 * on a JSX element when it is not part of a mapping, except when the element is
 * returned from a helper render function.
 *
 * The rule walks up the ancestors of the JSX element to check if one of them
 * is a CallExpression where the callee is a MemberExpression with the property "map".
 * If not—and if the JSX element is not directly returned from a helper function—
 * then a key prop is considered unnecessary and an error is reported.
 *
 * Note: This rule does not auto-fix.
 */

export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"enforce that the key prop is only used on components rendered as part of a mapping",
			recommended: false
		},
		schema: [],
		messages: {
			unnecessaryKey:
				"The key prop should only be used on elements that are directly rendered as part of an array mapping."
		}
	},

	create(context) {
		// Polyfill for context.getAncestors if it's not available.
		function getAncestors(node) {
			const ancestors = [];
			let current = node.parent;
			while (current) {
				ancestors.push(current);
				current = current.parent;
			}
			return ancestors;
		}

		/**
		 * Checks if any of the ancestors is a CallExpression
		 * representing an array mapping (i.e. its callee is a MemberExpression
		 * whose property is an identifier or literal named "map").
		 *
		 * @param {ASTNode[]} ancestors - The array of ancestor nodes.
		 * @returns {boolean} True if a mapping is detected; otherwise, false.
		 */
		function isInsideMapCall(ancestors) {
			return ancestors.some((node) => {
				if (
					node.type === "CallExpression" &&
					node.callee &&
					node.callee.type === "MemberExpression"
				) {
					const property = node.callee.property;
					return (
						(property.type === "Identifier" &&
							property.name === "map") ||
						(property.type === "Literal" &&
							property.value === "map")
					);
				}
				return false;
			});
		}

		/**
		 * Checks whether the JSX element is being returned from a helper render
		 * function. If so, we assume the key prop might be needed when the function
		 * is eventually invoked from a mapping.
		 *
		 * @param {ASTNode[]} ancestors - The array of ancestor nodes.
		 * @returns {boolean} True if the element is inside a helper render function.
		 */
		function isReturnedFromFunction(ancestors) {
			// Look for a ReturnStatement in the ancestry.
			return ancestors.some((node) => node.type === "ReturnStatement");
		}

		/**
		 * Reports a JSX element if it has a key prop and is not rendered as part
		 * of an inline mapping (and not simply returned from a render helper function).
		 *
		 * @param {ASTNode} node - The JSXOpeningElement node.
		 */
		function checkJSXOpeningElement(node) {
			// Find a key attribute.
			const keyAttribute = node.attributes.find(
				(attr) =>
					attr.type === "JSXAttribute" &&
					attr.name &&
					attr.name.name === "key"
			);

			if (!keyAttribute) {
				return;
			}

			// Retrieve ancestors (using context.getAncestors if available).
			const ancestors =
				typeof context.getAncestors === "function"
					? context.getAncestors()
					: getAncestors(node);

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
				node: keyAttribute,
				messageId: "unnecessaryKey"
			});
		}

		return {
			JSXOpeningElement: checkJSXOpeningElement
		};
	}
};
