import { ESLintUtils } from "@typescript-eslint/utils";

/* `requiresTypeChecking`: the rule uses type information when the parser
 * provides it (typescript-eslint's own convention, which also marks rules that
 * still run, with fewer findings, without it). Tools read it to tell which
 * rules a project gives up by linting without types. */
type AbsoluteRuleDocs = { requiresTypeChecking?: boolean };

export const createRule = ESLintUtils.RuleCreator<AbsoluteRuleDocs>(
	(name) => `https://absolutejs.com/documentation/eslint-${name}`
);
