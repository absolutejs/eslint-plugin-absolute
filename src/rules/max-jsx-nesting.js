export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Warn when JSX elements are nested too deeply, suggesting refactoring into a separate component.",
			recommended: false
		},
		// The rule accepts a single numeric option (minimum 1)
		schema: [
			{
				type: "number",
				minimum: 1
			}
		],
		messages: {
			tooDeeplyNested:
				"JSX element is nested too deeply ({{level}} levels, allowed is {{maxAllowed}} levels). Consider refactoring into a separate component."
		}
	},
	create(context) {
		// At this point, the provided option is guaranteed to be a number >= 1.
		const maxAllowed = context.options[0];

		/**
		 * Calculates the JSX nesting level for the given node by traversing the node.parent chain.
		 * The level is computed by counting the current node (level 1) plus each ancestor
		 * that is a JSXElement or JSXFragment.
		 * @param {ASTNode} node The JSX element node.
		 * @returns {number} The nesting level.
		 */
		function getJSXNestingLevel(node) {
			let level = 1; // count the current node as level 1
			let current = node.parent;
			while (current) {
				if (
					current.type === "JSXElement" ||
					current.type === "JSXFragment"
				) {
					level++;
				}
				current = current.parent;
			}
			return level;
		}

		return {
			JSXElement(node) {
				const level = getJSXNestingLevel(node);
				if (level > maxAllowed) {
					context.report({
						node,
						messageId: "tooDeeplyNested",
						data: { level, maxAllowed }
					});
				}
			}
		};
	}
};
