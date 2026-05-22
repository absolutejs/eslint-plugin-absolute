import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
	(name) => `https://absolutejs.com/documentation/eslint/${name}`
);
