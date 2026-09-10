import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "timestampNeedsZone";

/**
 * A Drizzle `timestamp` column holds an instant, and `timestamp without time
 * zone` cannot.
 *
 * The driver writes a Date as its UTC wall clock and reads a naive value back
 * as local, so a process outside UTC reads every one of them late by its own
 * offset. Postgres compares them correctly -- it reads them in the session's
 * zone, which is what they were written in -- so nothing looks wrong until
 * something compares one against the clock in JavaScript. Then a token that
 * expired hours ago reads as valid, a lease nobody holds reads as held, and a
 * scheduled run is skipped, with the data insisting all three are fine.
 *
 * The fix is the same every time and carries no cost, so this asks for it
 * rather than waiting for a column to become load-bearing. `date` and `time`
 * columns are untouched: a birthday and an opening hour are wall clocks, and
 * a zone on either would be a different kind of wrong.
 */
export const timestampWithTimezone = createRule<Options, MessageIds>({
	create(context) {
		/** `withTimezone: true`, written literally. A spread beside it might
		 *  carry one too, which is why a spread is still reported: appending
		 *  wins either way, since a later key overrides. */
		const declaresZone = (argument: TSESTree.CallExpressionArgument) =>
			argument.type === "ObjectExpression" &&
			argument.properties.some(
				(property) =>
					property.type === "Property" &&
					!property.computed &&
					((property.key.type === "Identifier" &&
						property.key.name === "withTimezone") ||
						(property.key.type === "Literal" &&
							property.key.value === "withTimezone")) &&
					property.value.type === "Literal" &&
					property.value.value === true
			);

		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (
					node.callee.type !== "Identifier" ||
					node.callee.name !== "timestamp"
				)
					return;
				const [options] = node.arguments;
				// A column name may come first: `timestamp('created_at', {…})`.
				const settings =
					options?.type === "Literal" ? node.arguments[1] : options;
				/* Settings handed over as a variable can be neither read nor
				 * appended to, and a complaint with no fix and no way to
				 * silence it is worse than the column it is about. */
				if (
					settings !== undefined &&
					settings.type !== "ObjectExpression"
				)
					return;
				if (settings !== undefined && declaresZone(settings)) return;
				context.report({
					fix: (fixer) => {
						if (settings === undefined) {
							const open = context.sourceCode.getLastToken(node);

							return open === null
								? null
								: fixer.insertTextBefore(
										open,
										node.arguments.length > 0
											? ", { withTimezone: true }"
											: "{ withTimezone: true }"
									);
						}
						if (settings.type !== "ObjectExpression") return null;
						const last = settings.properties.at(-1);

						return last === undefined
							? fixer.replaceText(
									settings,
									"{ withTimezone: true }"
								)
							: fixer.insertTextAfter(
									last,
									", withTimezone: true"
								);
					},
					messageId: "timestampNeedsZone",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Require withTimezone on Drizzle timestamp columns, which hold instants"
		},
		fixable: "code",
		messages: {
			timestampNeedsZone:
				"A timestamp column holds an instant, so it needs `withTimezone: true`. Without it the value reads back shifted by the reading process's offset, and a deadline compared in JavaScript is wrong by that much."
		},
		schema: [],
		type: "problem"
	},
	name: "timestamp-with-timezone"
});
