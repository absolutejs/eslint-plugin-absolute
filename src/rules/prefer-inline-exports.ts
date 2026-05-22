import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

/**
 * Flag `export { foo }` (no `from`, no rename) when `foo` is a local
 * declaration in the same file and could just have `export` prepended at the
 * declaration site. AI tooling commonly produces the trailing form when
 * mechanically rewriting `export default` — it works but it's noise.
 *
 * Intentionally allows:
 *  - `export { foo } from "..."` (re-export, different semantics)
 *  - `export { foo as bar }` (rename — the alias is the public name)
 *  - `export { type foo }` / `export type { foo }` (type-only export of a
 *    value-typed declaration; semantically distinct from inline export)
 *  - `export { Sentry }` where `Sentry` is an imported binding (can't be
 *    inline-exported without restructuring the import)
 *  - declarations already exported via another export (duplicate spec is a
 *    different problem)
 *  - `const a = 1, b = 2;` shared declarations where only some specifiers are
 *    re-exported (can't prepend `export` to one declarator)
 */

type Options = [];
type MessageIds = "preferInline";

type LocalDeclaration =
	| TSESTree.VariableDeclaration
	| TSESTree.FunctionDeclaration
	| TSESTree.ClassDeclaration
	| TSESTree.TSTypeAliasDeclaration
	| TSESTree.TSInterfaceDeclaration
	| TSESTree.TSEnumDeclaration;

const isLocalDeclaration = (node: TSESTree.Node): node is LocalDeclaration =>
	node.type === "VariableDeclaration" ||
	node.type === "FunctionDeclaration" ||
	node.type === "ClassDeclaration" ||
	node.type === "TSTypeAliasDeclaration" ||
	node.type === "TSInterfaceDeclaration" ||
	node.type === "TSEnumDeclaration";

const declarationName = (decl: LocalDeclaration) => {
	if (decl.type === "VariableDeclaration") {
		if (decl.declarations.length !== 1) return null;
		const [first] = decl.declarations;
		if (!first || first.id.type !== "Identifier") return null;
		return first.id.name;
	}
	if (!decl.id || decl.id.type !== "Identifier") return null;
	return decl.id.name;
};

const findOwnDeclaration = (program: TSESTree.Program, name: string) => {
	for (const stmt of program.body) {
		if (
			stmt.type === "ExportNamedDeclaration" &&
			stmt.declaration &&
			isLocalDeclaration(stmt.declaration) &&
			declarationName(stmt.declaration) === name
		) {
			return { alreadyExported: true, decl: stmt.declaration };
		}

		if (
			stmt.type === "ExportDefaultDeclaration" &&
			isLocalDeclaration(stmt.declaration) &&
			declarationName(stmt.declaration) === name
		) {
			return { alreadyExported: true, decl: stmt.declaration };
		}

		if (isLocalDeclaration(stmt) && declarationName(stmt) === name) {
			return { alreadyExported: false, decl: stmt };
		}
	}

	return null;
};

export const preferInlineExports = createRule<Options, MessageIds>({
	create(context) {
		const { sourceCode } = context;

		const program = sourceCode.ast;

		return {
			ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
				// Re-exports (`export { foo } from "..."`) are different.
				if (node.source) return;
				// Inline form is already correct.
				if (node.declaration) return;
				if (node.specifiers.length === 0) return;
				// Type-only export statement: `export type { foo }`.
				if (node.exportKind === "type") return;

				const fixable: {
					spec: TSESTree.ExportSpecifier;
					decl: LocalDeclaration;
				}[] = [];

				for (const spec of node.specifiers) {
					if (spec.type !== "ExportSpecifier") continue;
					if (spec.local.type !== "Identifier") continue;
					if (spec.exported.type !== "Identifier") continue;
					// Aliases are intentional — the alias *is* the public API.
					if (spec.local.name !== spec.exported.name) continue;
					// Type-only specifier on a value declaration: keep.
					if (spec.exportKind === "type") continue;

					const found = findOwnDeclaration(program, spec.local.name);
					if (!found) continue;
					if (found.alreadyExported) continue;

					fixable.push({ decl: found.decl, spec });
				}

				if (fixable.length === 0) return;

				const allSpecsAreFixable =
					fixable.length === node.specifiers.length;
				const names = fixable
					.map(({ spec }) =>
						spec.local.type === "Identifier" ? spec.local.name : ""
					)
					.filter((name) => name.length > 0);

				context.report({
					data: { names: names.join(", ") },
					fix(fixer) {
						const fixes: TSESLint.RuleFix[] = [];

						// Prepend `export ` to each fixable declaration.
						for (const { decl } of fixable) {
							const [declStart] = decl.range;
							fixes.push(
								fixer.insertTextBeforeRange(
									[declStart, declStart],
									"export "
								)
							);
						}

						// Mutate the trailing `export { ... }` statement: drop
						// the now-inlined specifiers, or remove it entirely if
						// nothing is left.
						if (allSpecsAreFixable) {
							fixes.push(fixer.remove(node));
						} else {
							const survivors = node.specifiers.filter(
								(spec) =>
									!fixable.some(
										(entry) => entry.spec === spec
									)
							);
							const replacement = `export { ${survivors
								.map((spec) => sourceCode.getText(spec))
								.join(", ")} };`;
							fixes.push(fixer.replaceText(node, replacement));
						}

						return fixes;
					},
					messageId: "preferInline",
					node
				});
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Prefer inlining `export` at a declaration site over a trailing `export { name }` statement when the name is a local declaration."
		},
		fixable: "code",
		messages: {
			preferInline:
				"Inline `export` at the declaration of `{{names}}` instead of re-exporting at the bottom of the file."
		},
		schema: [],
		type: "suggestion"
	},
	name: "prefer-inline-exports"
});
