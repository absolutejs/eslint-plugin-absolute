import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

const STATE_CLASS_NAMES = new Set([
	"active",
	"is-active",
	"is-selected",
	"selected"
]);
const ARIA_STATE_NAMES = new Set([
	"aria-current",
	"aria-pressed",
	"aria-selected"
]);

type Options = [];
type MessageIds = "missingAriaState";
type TemplateVisitor = { VElement: (node: AST.VElement) => void };
type ExpressionNode = { range: [number, number]; type: string };

const directiveArgument = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive && attribute.key.argument?.type === "VIdentifier"
		? attribute.key.argument.name
		: null;

const boundAttribute = (
	attribute: AST.VAttribute | AST.VDirective,
	name: string
): attribute is AST.VDirective =>
	attribute.directive &&
	attribute.key.name.name === "bind" &&
	directiveArgument(attribute) === name;

const literalAttribute = (
	attribute: AST.VAttribute | AST.VDirective,
	name: string
): attribute is AST.VAttribute =>
	!attribute.directive && attribute.key.name === name;

const propertyName = (property: AST.ESLintProperty) => {
	if (property.computed || property.type !== "Property") return null;
	if (property.key.type === "Identifier") return property.key.name;
	if (property.key.type === "Literal") {
		return typeof property.key.value === "string"
			? property.key.value
			: null;
	}

	return null;
};

const stateClassBinding = (node: AST.VElement) => {
	const classBinding = node.startTag.attributes.find((attribute) =>
		boundAttribute(attribute, "class")
	);
	const expression = classBinding?.value?.expression;
	if (expression?.type !== "ObjectExpression") return null;
	for (const candidate of expression.properties) {
		if (candidate.type !== "Property") continue;
		const name = propertyName(candidate);
		if (
			name !== null &&
			STATE_CLASS_NAMES.has(name) &&
			candidate.value !== undefined &&
			candidate.value !== null
		) {
			return { className: name, condition: candidate.value };
		}
	}

	return null;
};

const isTab = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) =>
			literalAttribute(attribute, "role") &&
			attribute.value?.type === "VLiteral" &&
			attribute.value.value === "tab"
	);

const matchingAriaState = (
	context: Parameters<typeof activeButtonHasAriaState.create>[0],
	node: AST.VElement,
	condition: ExpressionNode
) => {
	const expected = context.sourceCode.text.slice(...condition.range);

	return node.startTag.attributes.some((attribute) => {
		const name = directiveArgument(attribute);
		if (name === null || !ARIA_STATE_NAMES.has(name)) return false;
		const expression = attribute.directive
			? attribute.value?.expression
			: null;

		return (
			expression !== null &&
			expression !== undefined &&
			context.sourceCode.text.slice(...expression.range) === expected
		);
	});
};

const hasAriaState = (node: AST.VElement) =>
	node.startTag.attributes.some((attribute) => {
		const name = attribute.directive
			? directiveArgument(attribute)
			: attribute.key.name;

		return name !== null && ARIA_STATE_NAMES.has(name);
	});

export const activeButtonHasAriaState = createRule<Options, MessageIds>({
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
				if (node.rawName.toLowerCase() !== "button") return;
				const state = stateClassBinding(node);
				if (
					state === null ||
					matchingAriaState(context, node, state.condition)
				) {
					return;
				}
				const ariaAttribute = isTab(node)
					? "aria-selected"
					: "aria-pressed";
				const canFix = !hasAriaState(node);
				const insertion =
					node.startTag.range[1] -
					(node.startTag.selfClosing ? 2 : 1);
				context.report({
					data: { ariaAttribute, className: state.className },
					fix: canFix
						? (fixer) =>
								fixer.insertTextBeforeRange(
									[insertion, insertion],
									` :${ariaAttribute}="${context.sourceCode.text.slice(...state.condition.range)}"`
								)
						: undefined,
					loc: node.loc,
					messageId: "missingAriaState"
				});
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require conditionally active Vue buttons to expose the same state to assistive technology."
		},
		fixable: "code",
		messages: {
			missingAriaState:
				'Button state class "{{className}}" needs :{{ariaAttribute}} bound to the same condition so assistive technology and runtime diagnostics can recognize the selected state.'
		},
		schema: [],
		type: "problem"
	},
	name: "active-button-has-aria-state"
});
