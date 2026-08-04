import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "chainedAssertion";

export const noChainedTypeAssertions = createRule<Options, MessageIds>({
	create: (context) => ({
		TSAsExpression(node: TSESTree.TSAsExpression) {
			if (node.expression.type !== "TSAsExpression") return;
			context.report({ messageId: "chainedAssertion", node });
		}
	}),
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow chained TypeScript assertions such as `value as unknown as Target`, which bypass structural compatibility checks."
		},
		messages: {
			chainedAssertion:
				"Chained type assertions bypass TypeScript's compatibility checks. Validate or narrow the value, or fix the source type instead."
		},
		schema: [],
		type: "problem"
	},
	name: "no-chained-type-assertions"
});
