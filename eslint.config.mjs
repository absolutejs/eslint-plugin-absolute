import pluginJs from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Import ourselves from dist — this IS the plugin (run `bun run build` first)
import absolutePlugin from "./dist/index.js";

export default defineConfig([
	{ ignores: ["dist/**", "node_modules/**", ".absolutejs/**"] },

	pluginJs.configs.recommended,

	...tseslint.configs.recommended,

	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		rules: {
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
		},
	},
	{
		files: ["**/*.{ts,js,mjs}"],
		plugins: {
			absolute: absolutePlugin,
		},
		rules: {
			"absolute/explicit-object-types": "error",
			"absolute/max-depth-extended": ["error", 1],
			"absolute/min-var-length": [
				"error",
				{ allowedVars: ["_", "id"], minLength: 3 },
			],
			"absolute/no-explicit-return-type": "error",
			"absolute/no-useless-function": "error",
			"absolute/sort-exports": [
				"error",
				{ caseSensitive: true, natural: true, order: "asc" },
			],
			"absolute/sort-keys-fixable": [
				"error",
				{ caseSensitive: true, natural: true, order: "asc" },
			],
			"arrow-body-style": ["error", "as-needed"],
			"consistent-return": "error",
			eqeqeq: "error",
			"func-style": [
				"error",
				"expression",
				{ allowArrowFunctions: true },
			],
			"no-await-in-loop": "error",
			"no-duplicate-imports": "error",
			"no-else-return": "error",
			"no-empty-function": "error",
			"no-floating-decimal": "error",
			"no-implicit-coercion": "error",
			"no-implicit-globals": "error",
			"no-loop-func": "error",
			"no-magic-numbers": [
				"warn",
				{ detectObjects: false, enforceConst: true, ignore: [0, 1, 2] },
			],
			"no-nested-ternary": "error",
			"no-new-wrappers": "error",
			"no-param-reassign": "error",
			"no-return-await": "error",
			"no-shadow": "error",
			"no-unneeded-ternary": "error",
			"no-useless-assignment": "error",
			"no-useless-concat": "error",
			"no-useless-return": "error",
			"no-var": "error",
			"prefer-arrow-callback": "error",
			"prefer-const": "error",
			"prefer-destructuring": [
				"error",
				{ array: true, object: true },
				{ enforceForRenamedProperties: false },
			],
			"prefer-template": "error",
		},
	},
	{
		files: ["eslint.config.mjs"],
		rules: {
			"@typescript-eslint/no-unused-expressions": "off",
		},
	},
	{
		files: ["**/*.test.ts"],
		rules: {
			"absolute/min-var-length": "off",
			"no-magic-numbers": "off",
		},
	},
]);
