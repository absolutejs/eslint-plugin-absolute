import type { AST } from "vue-eslint-parser";
import { createRule } from "../createRule";

const DEFAULT_MAX_FIRST_LEVEL = 2;
const HEADING_NAME_PATTERN = /^h([1-6])$/;

type HeadingOrderOption = {
	maxFirstLevel?: number;
};

type Options = [HeadingOrderOption?];
type MessageIds = "firstHeadingTooDeep" | "skippedHeadingLevel";

type TemplateVisitor = {
	VElement: (node: AST.VElement) => void;
};

const headingLevel = (node: AST.VElement) => {
	const match = HEADING_NAME_PATTERN.exec(node.rawName.toLowerCase());
	if (!match) return null;
	const [, level] = match;

	return level ? Number(level) : null;
};

export const headingOrder = createRule<Options, MessageIds>({
	create(context) {
		const [options] = context.options;
		const maxFirstLevel = options?.maxFirstLevel ?? DEFAULT_MAX_FIRST_LEVEL;
		const { parserServices } = context.sourceCode;
		if (
			!parserServices ||
			!("defineTemplateBodyVisitor" in parserServices) ||
			typeof parserServices.defineTemplateBodyVisitor !== "function"
		) {
			return {};
		}

		let previousLevel: number | null = null;

		return parserServices.defineTemplateBodyVisitor({
			VElement(node) {
				const currentLevel = headingLevel(node);
				if (currentLevel === null) return;

				if (previousLevel === null && currentLevel > maxFirstLevel) {
					context.report({
						data: {
							actual: currentLevel,
							maximum: maxFirstLevel
						},
						loc: node.loc,
						messageId: "firstHeadingTooDeep"
					});
				}
				if (
					previousLevel !== null &&
					currentLevel > previousLevel + 1
				) {
					context.report({
						data: {
							actual: currentLevel,
							previous: previousLevel
						},
						loc: node.loc,
						messageId: "skippedHeadingLevel"
					});
				}
				previousLevel = currentLevel;
			}
		} satisfies TemplateVisitor);
	},
	defaultOptions: [{ maxFirstLevel: DEFAULT_MAX_FIRST_LEVEL }],
	meta: {
		docs: {
			description:
				"Require Vue templates to start at h1 or h2 and prevent heading levels from being skipped."
		},
		messages: {
			firstHeadingTooDeep:
				"The first heading is h{{actual}}. Start this template at h{{maximum}} or higher so it can join a valid document outline.",
			skippedHeadingLevel:
				"Heading order skips from h{{previous}} to h{{actual}}. Use the next sequential heading level."
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					maxFirstLevel: {
						maximum: 6,
						minimum: 1,
						type: "integer"
					}
				},
				type: "object"
			}
		],
		type: "problem"
	},
	name: "heading-order"
});
