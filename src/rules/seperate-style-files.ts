import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "moveToFile";

export const seperateStyleFiles: TSESLint.RuleModule<MessageIds, Options> = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Warn when a component file (.jsx or .tsx) contains a style object typed as CSSProperties. " +
				"Style objects should be moved to their own file under the style folder."
		},
		schema: [],
		messages: {
			moveToFile:
				'Style object "{{name}}" is typed as {{typeName}}. Move it to its own file under the style folder.'
		}
	},

	defaultOptions: [],

	create(context) {
		// Only run this rule on .tsx or .jsx files.
		const filename = context.getFilename();
		if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) {
			return {};
		}

		return {
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				// Ensure this is a variable declaration with an Identifier.
				if (!node.id || node.id.type !== "Identifier") {
					return;
				}

				const identifier = node.id;

				// Check if there's a type annotation on the variable.
				const idTypeAnnotation = identifier.typeAnnotation;
				if (
					!idTypeAnnotation ||
					idTypeAnnotation.type !== "TSTypeAnnotation"
				) {
					return;
				}

				const typeNode = idTypeAnnotation.typeAnnotation;
				if (!typeNode || typeNode.type !== "TSTypeReference") {
					return;
				}

				// Handle both Identifier and TSQualifiedName cases.
				const typeNameNode = typeNode.typeName;
				let typeName: string | null = null;

				// When typeName is a simple Identifier.
				if (typeNameNode.type === "Identifier") {
					typeName = typeNameNode.name;
				}
				// When typeName is a TSQualifiedName, e.g., React.CSSProperties.
				else if (typeNameNode.type === "TSQualifiedName") {
					const right = typeNameNode.right;
					typeName = right.name;
				}

				// Report if the type name is CSSProperties.
				if (typeName === "CSSProperties") {
					context.report({
						node,
						messageId: "moveToFile",
						data: {
							name: identifier.name,
							typeName
						}
					});
				}
			}
		};
	}
};
