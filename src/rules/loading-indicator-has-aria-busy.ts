import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

/**
 * Loading indicators (spinner/loader/skeleton-classed elements) must carry
 * `aria-busy` — or sit inside an element that does, or be a `role="progressbar"`.
 * Assistive technology gets a pending state, and runtime watchdogs (Beacon's
 * stuck-loading signal) can observe a spinner that never resolves. A spinner
 * without the attribute is invisible to both.
 */

const LOADING_CLASS_TOKENS = new Set([
	"loader",
	"loading",
	"skeleton",
	"spinner"
]);

type Options = [];
type MessageIds = "missingAriaBusy";
type TemplateVisitor = { VElement: (node: AST.VElement) => void };

const directiveArgument = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive && attribute.key.argument?.type === "VIdentifier"
		? attribute.key.argument.name
		: null;

const attributeName = (attribute: AST.VAttribute | AST.VDirective) =>
	attribute.directive ? directiveArgument(attribute) : attribute.key.name;

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

const hasLoadingToken = (className: string) =>
	className
		.split(/[-_:]/u)
		.some((token) => LOADING_CLASS_TOKENS.has(token.toLowerCase()));

const loadingClassName = (classList: string) =>
	classList
		.split(/\s+/u)
		.find((className) => className !== "" && hasLoadingToken(className)) ??
	null;

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

type LoadingClassMatch = {
	anchor: AST.VAttribute | AST.VDirective;
	className: string;
	/** Present when the class is conditional — the fix binds to it. */
	condition: { range: [number, number] } | null;
};

const staticLoadingClass = (node: AST.VElement): LoadingClassMatch | null => {
	const classAttribute = node.startTag.attributes.find((attribute) =>
		literalAttribute(attribute, "class")
	);
	if (
		classAttribute === undefined ||
		classAttribute.directive ||
		classAttribute.value?.type !== "VLiteral"
	) {
		return null;
	}
	const className = loadingClassName(classAttribute.value.value);

	return className === null
		? null
		: { anchor: classAttribute, className, condition: null };
};

const boundLoadingClass = (node: AST.VElement): LoadingClassMatch | null => {
	const classBinding = node.startTag.attributes.find((attribute) =>
		boundAttribute(attribute, "class")
	);
	if (classBinding === undefined) return null;
	const expression = classBinding.value?.expression;
	if (expression === null || expression === undefined) return null;
	if (expression.type === "ObjectExpression") {
		for (const candidate of expression.properties) {
			if (candidate.type !== "Property") continue;
			const name = propertyName(candidate);
			if (name !== null && hasLoadingToken(name)) {
				return {
					anchor: classBinding,
					className: name,
					condition: candidate.value ?? null
				};
			}
		}

		return null;
	}
	if (expression.type === "ArrayExpression") {
		for (const element of expression.elements) {
			if (
				element !== null &&
				element.type === "Literal" &&
				typeof element.value === "string" &&
				loadingClassName(element.value) !== null
			) {
				return {
					anchor: classBinding,
					className: loadingClassName(element.value) ?? element.value,
					condition: null
				};
			}
		}
	}

	return null;
};

const hasAriaBusy = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) => attributeName(attribute) === "aria-busy"
	);

const isProgressbar = (node: AST.VElement) =>
	node.startTag.attributes.some(
		(attribute) =>
			(literalAttribute(attribute, "role") &&
				attribute.value?.type === "VLiteral" &&
				attribute.value.value === "progressbar") ||
			boundAttribute(attribute, "role")
	);

const busyAncestor = (node: AST.VElement) => {
	let parent: AST.VElement["parent"] = node.parent;
	while (parent !== null && parent.type === "VElement") {
		if (hasAriaBusy(parent)) return true;
		parent = parent.parent;
	}

	return false;
};

export const loadingIndicatorHasAriaBusy = createRule<Options, MessageIds>({
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
				const match =
					staticLoadingClass(node) ?? boundLoadingClass(node);
				if (match === null) return;
				if (
					hasAriaBusy(node) ||
					isProgressbar(node) ||
					busyAncestor(node)
				) {
					return;
				}
				const conditionText =
					match.condition === null
						? null
						: context.sourceCode.text.slice(
								...match.condition.range
							);
				const insertion =
					conditionText === null
						? `aria-busy="true"`
						: `:aria-busy="${conditionText}"`;
				const lineStart =
					context.sourceCode.text.lastIndexOf(
						"\n",
						match.anchor.range[0] - 1
					) + 1;
				const leadingText = context.sourceCode.text.slice(
					lineStart,
					match.anchor.range[0]
				);
				const separator =
					leadingText.trim() === "" ? `\n${leadingText}` : " ";
				context.report({
					data: { className: match.className },
					fix: (fixer) =>
						fixer.insertTextAfterRange(
							match.anchor.range,
							`${separator}${insertion}`
						),
					loc: node.loc,
					messageId: "missingAriaBusy"
				});
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require loading indicators to expose their pending state through aria-busy so assistive technology and runtime watchdogs can observe them."
		},
		fixable: "code",
		messages: {
			missingAriaBusy:
				'Loading indicator class "{{className}}" needs aria-busy (or role="progressbar") so assistive technology and runtime watchdogs can see the pending state.'
		},
		schema: [],
		type: "problem"
	},
	name: "loading-indicator-has-aria-busy"
});
