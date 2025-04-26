export default {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Warn when a component file (.jsx or .tsx) contains a style object typed as CSSProperties. " +
				"Style objects should be moved to their own file under the style folder.",
			recommended: false
		},
		schema: [],
		messages: {
			moveToFile:
				'Style object "{{name}}" is typed as {{typeName}}. Move it to its own file under the style folder.'
		}
	},

	create(context) {
		// Only run this rule on .tsx or .jsx files.
		const filename = context.getFilename();
		if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) {
			return {};
		}

		return {
			VariableDeclarator(node) {
				// Ensure this is a variable declaration with an Identifier.
				if (!node.id || node.id.type !== "Identifier") return;

				const identifier = node.id;
				// Check if there's a type annotation on the variable.
				if (!identifier.typeAnnotation) return;

				const typeNode = identifier.typeAnnotation.typeAnnotation;
				// Handle both Identifier and TSQualifiedName cases.
				if (typeNode.type === "TSTypeReference" && typeNode.typeName) {
					let typeName = null;

					// When typeName is a simple Identifier.
					if (typeNode.typeName.type === "Identifier") {
						typeName = typeNode.typeName.name;
					}
					// When typeName is a TSQualifiedName, e.g., React.CSSProperties.
					else if (typeNode.typeName.type === "TSQualifiedName") {
						typeName = typeNode.typeName.right.name;
					}

					// Report if the type name is CSSProperties.
					if (typeName === "CSSProperties") {
						context.report({
							node,
							messageId: "moveToFile",
							data: {
								name: identifier.name,
								typeName: typeName
							}
						});
					}
				}
			}
		};
	}
};
