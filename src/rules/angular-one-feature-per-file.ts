import { AST_NODE_TYPES, TSESLint, TSESTree } from "@typescript-eslint/utils";

type Options = [];
type MessageIds = "multiFeature";

// Class-level Angular decorators that make a class a top-level "feature"
// per the Angular Style Guide's "Single Responsibility / Rule of One."
// Member decorators like @Input, @Output, @HostListener are intentionally
// out of scope.
const FEATURE_DECORATOR_NAMES: ReadonlySet<string> = new Set([
	"Component",
	"Directive",
	"Injectable",
	"NgModule",
	"Pipe"
]);

// Match by the local name. An aliased import (e.g.,
// `import { Component as NgComponent }`) would slip past, but that's rare
// enough to not be worth pulling in typed services for.
const getDecoratorName = (decorator: TSESTree.Decorator) => {
	const { expression } = decorator;
	if (
		expression.type === AST_NODE_TYPES.CallExpression &&
		expression.callee.type === AST_NODE_TYPES.Identifier
	) {
		return expression.callee.name;
	}
	if (expression.type === AST_NODE_TYPES.Identifier) {
		return expression.name;
	}
	return null;
};

const isFeatureClass = (node: TSESTree.ClassDeclaration) => {
	if (!node.decorators || node.decorators.length === 0) return false;
	return node.decorators.some((decorator) => {
		const name = getDecoratorName(decorator);
		return name !== null && FEATURE_DECORATOR_NAMES.has(name);
	});
};

export const angularOneFeaturePerFile: TSESLint.RuleModule<
	MessageIds,
	Options
> = {
	create(context) {
		const seenFeatures: TSESTree.ClassDeclaration[] = [];

		return {
			ClassDeclaration(node: TSESTree.ClassDeclaration) {
				if (!isFeatureClass(node)) return;
				seenFeatures.push(node);
				if (seenFeatures.length === 1) return;
				context.report({
					messageId: "multiFeature",
					node: node.id ?? node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				'Disallow defining more than one Angular feature class (@Component, @Directive, @Pipe, @Injectable, @NgModule) per file. Mirrors the Angular Style Guide\'s Single Responsibility / Rule of One. Test and Storybook files legitimately define stub/host classes alongside the subject under test — disable this rule for those files via an ESLint override (e.g., `{ files: ["**/*.spec.ts", "**/*.stories.ts"], rules: { "absolute/angular-one-feature-per-file": "off" } }`).'
		},
		messages: {
			multiFeature:
				"Only one Angular feature class is allowed per file. Move this class into its own file (Angular Style Guide: Single Responsibility / Rule of One)."
		},
		schema: [],
		type: "problem"
	}
};
