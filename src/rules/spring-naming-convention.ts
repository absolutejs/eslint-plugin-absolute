import { TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds =
	| "firstMustEndWithSprings"
	| "firstMustHaveBase"
	| "secondMustMatch"
	| "pluralRequired";

const SPRINGS_SUFFIX = "Springs";

const checkUseSpring = (
	context: TSESLint.RuleContext<MessageIds, Options>,
	firstElem: TSESTree.Identifier,
	secondElem: TSESTree.Identifier
) => {
	const firstName = firstElem.name;
	const secondName = secondElem.name;

	if (!firstName.endsWith(SPRINGS_SUFFIX)) {
		context.report({
			messageId: "firstMustEndWithSprings",
			node: firstElem
		});
		return;
	}

	const base = firstName.slice(0, -SPRINGS_SUFFIX.length);
	if (!base) {
		context.report({
			messageId: "firstMustHaveBase",
			node: firstElem
		});
		return;
	}

	const expectedSecond = `${base}Api`;
	if (secondName !== expectedSecond) {
		context.report({
			data: { expected: expectedSecond },
			messageId: "secondMustMatch",
			node: secondElem
		});
	}
};

const checkUseSprings = (
	context: TSESLint.RuleContext<MessageIds, Options>,
	firstElem: TSESTree.Identifier,
	secondElem: TSESTree.Identifier
) => {
	const firstName = firstElem.name;
	const secondName = secondElem.name;

	if (!firstName.endsWith(SPRINGS_SUFFIX)) {
		context.report({
			messageId: "firstMustEndWithSprings",
			node: firstElem
		});
		return;
	}

	const basePlural = firstName.slice(0, -SPRINGS_SUFFIX.length);
	if (!basePlural) {
		context.report({
			messageId: "firstMustHaveBase",
			node: firstElem
		});
		return;
	}

	if (!basePlural.endsWith("s")) {
		context.report({
			messageId: "pluralRequired",
			node: firstElem
		});
		return;
	}

	const expectedSecond = `${basePlural}Api`;
	if (secondName !== expectedSecond) {
		context.report({
			data: { expected: expectedSecond },
			messageId: "secondMustMatch",
			node: secondElem
		});
	}
};

export const springNamingConvention: TSESLint.RuleModule<MessageIds, Options> =
	{
		create(context) {
			return {
				VariableDeclarator(node: TSESTree.VariableDeclarator) {
					const { init } = node;

					if (
						!init ||
						init.type !== "CallExpression" ||
						init.callee.type !== "Identifier"
					) {
						return;
					}

					const hookName = init.callee.name;
					if (hookName !== "useSpring" && hookName !== "useSprings") {
						return;
					}

					if (node.id.type !== "ArrayPattern") {
						return;
					}

					const { elements } = node.id;
					if (elements.length < 2) {
						return;
					}

					const [firstElem, secondElem] = elements;

					if (
						!firstElem ||
						firstElem.type !== "Identifier" ||
						!secondElem ||
						secondElem.type !== "Identifier"
					) {
						return;
					}

					if (hookName === "useSpring") {
						checkUseSpring(context, firstElem, secondElem);
						return;
					}

					if (hookName === "useSprings") {
						checkUseSprings(context, firstElem, secondElem);
					}
				}
			};
		},
		defaultOptions: [],
		meta: {
			docs: {
				description:
					"Enforce correct naming for useSpring and useSprings hook destructuring"
			},
			messages: {
				firstMustEndWithSprings:
					"The first variable must end with 'Springs'.",
				firstMustHaveBase:
					"The first variable must have a non-empty name before 'Springs'.",
				pluralRequired:
					"The first variable for useSprings should be plural (ending with 's') before 'Springs'.",
				secondMustMatch:
					"The second variable must be named '{{expected}}'."
			},
			schema: [],
			type: "problem"
		}
	};
