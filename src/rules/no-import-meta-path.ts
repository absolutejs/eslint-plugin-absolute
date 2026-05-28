import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../createRule";

type Options = [];
type MessageIds = "importMetaPath" | "importMetaUrl";

// Properties of `import.meta` that resolve a filesystem path from the current
// module's own location: Bun's `dir`, Node's `dirname`/`filename`.
const FILESYSTEM_PATH_PROPERTIES = new Set(["dir", "dirname", "filename"]);

const isImportMeta = (node: TSESTree.Node) =>
	node.type === "MetaProperty" &&
	node.meta.name === "import" &&
	node.property.name === "meta";

/**
 * For a member access `import.meta.<x>`, returns `<x>`; otherwise null.
 */
const importMetaProperty = (node: TSESTree.MemberExpression) => {
	if (!isImportMeta(node.object)) return null;
	if (node.computed || node.property.type !== "Identifier") return null;

	return node.property.name;
};

const calleeName = (callee: TSESTree.Node) => {
	if (callee.type === "Identifier") return callee.name;
	if (
		callee.type === "MemberExpression" &&
		callee.property.type === "Identifier"
	) {
		return callee.property.name;
	}

	return null;
};

/**
 * Flags filesystem paths derived from a module's own location:
 * `import.meta.dir`/`dirname`/`filename` and `fileURLToPath(import.meta.url)`.
 *
 * These resolve relative to the *current file*, which moves when the server is
 * bundled — your `src/` tree under `absolute dev`, the bundled `dist/` under
 * `absolute start` — so module-relative runtime/data paths silently break in
 * production (and only there, since dev runs from source). Anchor to
 * `projectRoot` from `@absolutejs/absolute` (or `process.cwd()`) instead, which
 * is identical in both modes.
 *
 * `new URL("./asset", import.meta.url)` is intentionally NOT flagged — that's
 * the bundler-rewritten asset-reference form, which survives bundling.
 */
export const noImportMetaPath = createRule<Options, MessageIds>({
	create(context) {
		return {
			CallExpression(node: TSESTree.CallExpression) {
				if (calleeName(node.callee) !== "fileURLToPath") return;
				const urlArgument = node.arguments.find(
					(argument) =>
						argument.type === "MemberExpression" &&
						importMetaProperty(argument) === "url"
				);
				if (urlArgument) {
					context.report({
						messageId: "importMetaUrl",
						node: urlArgument
					});
				}
			},
			MemberExpression(node: TSESTree.MemberExpression) {
				const property = importMetaProperty(node);
				if (property && FILESYSTEM_PATH_PROPERTIES.has(property)) {
					context.report({
						data: { property },
						messageId: "importMetaPath",
						node
					});
				}
			}
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description:
				"Disallow deriving filesystem paths from a module's own location (`import.meta.dir`/`dirname`/`filename`, `fileURLToPath(import.meta.url)`). They move when the server is bundled, so paths break in `absolute start`. Anchor to `projectRoot` from @absolutejs/absolute or `process.cwd()`. This targets application server code; a library locating its OWN shipped assets is a legitimate exception (projectRoot is the consuming app's root, not the package's location) — turn the rule off for those files via an override."
		},
		messages: {
			importMetaPath:
				"`import.meta.{{property}}` resolves this module's own location, which is your src/ tree in `absolute dev` but the bundled dist/ in `absolute start` — module-relative paths silently break in production. Anchor runtime/data paths to `projectRoot` from @absolutejs/absolute (or `process.cwd()`).",
			importMetaUrl:
				"`fileURLToPath(import.meta.url)` derives a filesystem path from this module's own location, which moves when the server is bundled (src/ in `absolute dev`, dist/ in `absolute start`) — so the path silently breaks in production. Anchor runtime/data paths to `projectRoot` from @absolutejs/absolute (or `process.cwd()`)."
		},
		schema: [],
		type: "problem"
	},
	name: "no-import-meta-path"
});
