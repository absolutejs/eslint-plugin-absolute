import { createRule } from "../createRule";
import { scanButtonAccessibility } from "../utils/buttonAccessibility";

type Options = [];
type MessageIds = "iconNotHidden";

const reportExposedIcon = (
	context: Parameters<typeof buttonIconIsHidden.create>[0],
	icon: { openingEnd: number; start: number }
) => {
	const start = context.sourceCode.getLocFromIndex(icon.start);
	context.report({
		fix: (fixer) =>
			fixer.insertTextBeforeRange(
				[icon.openingEnd, icon.openingEnd],
				' aria-hidden="true"'
			),
		loc: { end: start, start },
		messageId: "iconNotHidden"
	});
};

export const buttonIconIsHidden = createRule<Options, MessageIds>({
	create(context) {
		return {
			Program() {
				scanButtonAccessibility(context.sourceCode.text)
					.flatMap((finding) => finding.exposedIcons)
					.forEach((icon) => reportExposedIcon(context, icon));
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require Material Icons inside buttons to be hidden from assistive technology across frontend template syntaxes."
		},
		fixable: "code",
		messages: {
			iconNotHidden:
				'Material Icons inside buttons are decorative. Add aria-hidden="true" so assistive technology reads the button action instead of the icon ligature.'
		},
		schema: [],
		type: "problem"
	},
	name: "button-icon-is-hidden"
});
