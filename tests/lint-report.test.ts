import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ESLint } from "eslint";

test("project reporting matches ordinary ESLint coverage, locations and severity", async () => {
	const root = await mkdtemp(join(process.cwd(), ".lint-report-"));
	try {
		await writeFile(
			join(root, "eslint.config.mjs"),
			"export default [{ignores:['ignored.js']},{rules:{'no-debugger':'error'}}]"
		);
		await Promise.all(
			[
				"alpha.js",
				"Z.js",
				".hidden.js",
				"9.js",
				"é.js",
				"ignored.js"
			].map((name) => writeFile(join(root, name), "debugger;"))
		);
		const expected = await new ESLint({ cwd: root }).lintFiles(["."]);
		const result = Bun.spawnSync(
			[process.execPath, join(process.cwd(), "report.mjs")],
			{ cwd: root }
		);
		expect(result.exitCode).toBe(1);
		const rows = JSON.parse(result.stdout.toString());
		expect(
			rows.sort((left: { file: string }, right: { file: string }) =>
				left.file.localeCompare(right.file)
			)
		).toEqual(
			expected
				.map(({ filePath, messages }) => ({
					file: filePath.slice(root.length + 1),
					messages: messages.map(
						({ ruleId, message, line, column, severity }) => ({
							column,
							line,
							message,
							ruleId,
							severity
						})
					)
				}))
				.sort((left, right) => left.file.localeCompare(right.file))
		);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
}, 30_000);
