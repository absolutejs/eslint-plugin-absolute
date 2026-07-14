import { createRule } from "../createRule";
import { scanButtonAccessibility } from "../utils/buttonAccessibility";

type Options = [];
type MessageIds = "missingAccessibleName";

export const iconButtonHasAccessibleName = createRule<Options, MessageIds>({
	create(context) {
		return {
			Program() {
				for (const finding of scanButtonAccessibility(
					context.sourceCode.text
				)) {
					if (!finding.missingAccessibleName) continue;
					const start = context.sourceCode.getLocFromIndex(
						finding.buttonStart
					);
					const insertion = finding.accessibleNameInsertion;
					context.report({
						fix: insertion
							? (fixer) =>
									fixer.insertTextBeforeRange(
										[
											finding.buttonOpeningEnd,
											finding.buttonOpeningEnd
										],
										insertion
									)
							: undefined,
						loc: { end: start, start },
						messageId: "missingAccessibleName"
					});
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require icon-only buttons to have an aria-label or aria-labelledby across frontend template syntaxes."
		},
		fixable: "code",
		messages: {
			missingAccessibleName:
				"Icon-only buttons need a descriptive aria-label or aria-labelledby. A title or raw icon name is not an accessible action name."
		},
		schema: [],
		type: "problem"
	},
	name: "icon-button-has-accessible-name"
});
