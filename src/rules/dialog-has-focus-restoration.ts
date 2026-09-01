import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "missingBeforeUnmount" | "missingRef";
type TemplateVisitor = { VElement: (node: AST.VElement) => void };

const directiveArgument = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive && attribute.key.argument?.type === "VIdentifier"
		? attribute.key.argument.name
		: null;

const literalAttribute = (
	attribute: AST.VAttribute | AST.VDirective,
	name: string
): attribute is AST.VAttribute =>
	!attribute.directive && attribute.key.name === name;

const boundAttribute = (
	attribute: AST.VAttribute | AST.VDirective,
	name: string
) =>
	attribute.directive &&
	attribute.key.name.name === "bind" &&
	directiveArgument(attribute) === name;

const hasAttribute = (node: AST.VElement, name: string) =>
	node.startTag.attributes.some(
		(attribute) =>
			literalAttribute(attribute, name) || boundAttribute(attribute, name)
	);

const isDialog = (node: AST.VElement) =>
	node.rawName.toLowerCase() === "dialog" ||
	node.startTag.attributes.some(
		(attribute) =>
			literalAttribute(attribute, "role") &&
			attribute.value?.type === "VLiteral" &&
			attribute.value.value.toLowerCase() === "dialog"
	);

const hasBeforeUnmountHandler = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) =>
			attribute.directive &&
			attribute.key.name.name === "on" &&
			directiveArgument(attribute) === "vue:before-unmount"
	);

export const dialogHasFocusRestoration = createRule<Options, MessageIds>({
	create(context) {
		const { parserServices } = context.sourceCode;
		if (
			!parserServices ||
			!("defineTemplateBodyVisitor" in parserServices) ||
			typeof parserServices.defineTemplateBodyVisitor !== "function"
		) {
			return {};
		}

		return parserServices.defineTemplateBodyVisitor({
			VElement(node) {
				if (!isDialog(node)) return;
				if (!hasAttribute(node, "ref")) {
					context.report({ loc: node.loc, messageId: "missingRef" });
				}
				if (!hasBeforeUnmountHandler(node)) {
					context.report({
						loc: node.loc,
						messageId: "missingBeforeUnmount"
					});
				}
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require Vue dialogs to expose a focus-restoration lifecycle hook for local or component teardown."
		},
		messages: {
			missingBeforeUnmount:
				"A dialog needs a @vue:before-unmount handler that restores focus before local or parent-controlled teardown removes its focused subtree.",
			missingRef:
				"A dialog needs a template ref so its restoration handler can determine whether it owns focus."
		},
		schema: [],
		type: "problem"
	},
	name: "dialog-has-focus-restoration"
});
