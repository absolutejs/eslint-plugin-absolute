import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "uselessFunction";

export const noUselessFunction = createRule<Options, MessageIds>({
	create(context) {
		// A returned object is "static" only when every member is a plain literal
		// (string/number/boolean/null, or a no-substitution template). Such an
		// object could be hoisted out and exported directly — that's the anti-
		// pattern this rule targets. The moment a member reads a variable, calls
		// something, spreads, or nests a function/object/array, the function is a
		// real factory: it defers evaluation so each call captures live state
		// (config read at call time, fresh mutable counters, a mock method, ...).
		const isStaticObjectLiteral = (
			object: TSESTree.ObjectExpression
		): boolean =>
			object.properties.every((property) => {
				if (property.type !== "Property" || property.computed) {
					return false;
				}
				const { value } = property;
				return (
					value.type === "Literal" ||
					(value.type === "TemplateLiteral" &&
						value.expressions.length === 0)
				);
			});

		// A function anywhere inside a call argument (a direct callback, or a
		// method/stub nested in a config/mock object passed to a call — e.g.
		// `mock.module(path, () => ({ getStore: () => ({}) }))`) is intentional,
		// not a hoist-able constant.
		const isWithinCallArgument = (
			node: TSESTree.ArrowFunctionExpression
		): boolean => {
			let child: TSESTree.Node = node;
			let current: TSESTree.Node | undefined = node.parent;
			while (current) {
				if (
					current.type === "CallExpression" &&
					current.arguments.some((argument) => argument === child)
				) {
					return true;
				}
				child = current;
				current = current.parent;
			}

			return false;
		};

		return {
			ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
				if (
					node.params.length !== 0 ||
					!node.body ||
					node.body.type !== "ObjectExpression"
				) {
					return;
				}
				// Only the truly-useless case: a static, fully-literal object that
				// could be exported directly. A factory that captures live state or
				// is passed inside a call argument is intentional.
				if (!isStaticObjectLiteral(node.body)) {
					return;
				}
				if (isWithinCallArgument(node)) {
					return;
				}
				context.report({
					messageId: "uselessFunction",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring)."
		},
		messages: {
			uselessFunction:
				"This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function."
		},
		schema: [],
		type: "suggestion"
	},
	name: "no-useless-function"
});
