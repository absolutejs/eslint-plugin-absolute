import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "missingKeydown" | "missingRef" | "missingTabindex";
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

const isAriaModal = (node: AST.VElement) =>
	node.startTag.attributes.some((attribute) => {
		if (literalAttribute(attribute, "aria-modal")) {
			return (
				attribute.value?.type === "VLiteral" &&
				attribute.value.value.toLowerCase() === "true"
			);
		}

		return boundAttribute(attribute, "aria-modal");
	});

const hasKeydownHandler = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) =>
			attribute.directive &&
			attribute.key.name.name === "on" &&
			directiveArgument(attribute) === "keydown"
	);

export const modalHasFocusManagement = createRule<Options, MessageIds>({
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
				if (!isAriaModal(node)) return;
				if (!hasAttribute(node, "ref")) {
					context.report({ loc: node.loc, messageId: "missingRef" });
				}
				if (!hasAttribute(node, "tabindex")) {
					context.report({
						loc: node.loc,
						messageId: "missingTabindex"
					});
				}
				if (!hasKeydownHandler(node)) {
					context.report({
						loc: node.loc,
						messageId: "missingKeydown"
					});
				}
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require Vue ARIA modals to expose hooks for initial focus, focus fallback, and keyboard containment."
		},
		messages: {
			missingKeydown:
				"ARIA modal needs a keydown handler that contains Tab and Shift+Tab focus within the modal.",
			missingRef:
				"ARIA modal needs a template ref so opening code can move focus into it and closing code can coordinate restoration.",
			missingTabindex:
				'ARIA modal needs tabindex="-1" (or a bound tabindex) as a programmatic focus fallback.'
		},
		schema: [],
		type: "problem"
	},
	name: "modal-has-focus-management"
});
