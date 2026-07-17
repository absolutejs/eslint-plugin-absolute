import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "noInlinePropTypes";

const checkParameter = (
	context: Parameters<
		ReturnType<typeof createRule<Options, MessageIds>>["create"]
	>[0],
	parameter: TSESTree.Parameter
) => {
	if (
		parameter.type !== "ObjectPattern" ||
		parameter.typeAnnotation?.type !== "TSTypeAnnotation" ||
		parameter.typeAnnotation.typeAnnotation.type !== "TSTypeLiteral"
	)
		return;
	context.report({ messageId: "noInlinePropTypes", node: parameter });
};

export const noInlinePropTypes = createRule<Options, MessageIds>({
	create(context) {
		return {
			"FunctionDeclaration, ArrowFunctionExpression, FunctionExpression"(
				node:
					| TSESTree.ArrowFunctionExpression
					| TSESTree.FunctionDeclaration
					| TSESTree.FunctionExpression
			) {
				const [firstParameter] = node.params;
				if (firstParameter) checkParameter(context, firstParameter);
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require a named type for destructured component props without applying the broader no-inline-object-types policy."
		},
		messages: {
			noInlinePropTypes:
				"Inline prop type definitions are not allowed. Use a named type alias or interface instead of an inline object type."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-inline-prop-types"
});
