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
					context.report({
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
		messages: {
			missingAccessibleName:
				"Icon-only buttons need a descriptive aria-label or aria-labelledby. A title or raw icon name is not an accessible action name."
		},
		schema: [],
		type: "problem"
	},
	name: "icon-button-has-accessible-name"
});
