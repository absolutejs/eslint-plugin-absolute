import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "missingState";
type TemplateVisitor = { VElement: (node: AST.VElement) => void };

const directiveArgument = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive && attribute.key.argument?.type === "VIdentifier"
		? attribute.key.argument.name
		: null;

const attributeName = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive ? directiveArgument(attribute) : attribute.key.name;

const isProgressbar = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) =>
			!attribute.directive &&
			attribute.key.name === "role" &&
			attribute.value?.type === "VLiteral" &&
			attribute.value.value === "progressbar"
	);

const hasState = (node: AST.VElement) =>
	node.startTag.attributes.some((attribute) => {
		const name = attributeName(attribute);

		return (
			name === "aria-valuenow" ||
			name === "aria-busy" ||
			name === "data-beacon-loading"
		);
	});

export const progressbarHasState = createRule<Options, MessageIds>({
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
				if (!isProgressbar(node) || hasState(node)) return;
				context.report({
					loc: node.loc,
					messageId: "missingState"
				});
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require progressbars to distinguish determinate values from explicit indeterminate loading state."
		},
		messages: {
			missingState:
				"Progressbar needs aria-valuenow for a determinate value, or aria-busy/data-beacon-loading for an indeterminate loader."
		},
		schema: [],
		type: "problem"
	},
	name: "progressbar-has-state"
});
