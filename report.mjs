#!/usr/bin/env node
import console from "node:console";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import process from "node:process";

// Resolve ESLint and its plugins from the project, including when the reporter
// is supplied by Studio or installed in a different workspace.
const projectRequire = createRequire(join(process.cwd(), "package.json"));
try {
	const { ESLint } = projectRequire("eslint");
	const reports = await new ESLint().lintFiles(["."]);
	const results = reports.map(({ filePath, messages }) => ({
		file: relative(process.cwd(), filePath),
		messages: messages.map(
			({ ruleId, message, line, column, severity }) => ({
				column,
				line,
				message,
				ruleId,
				severity
			})
		)
	}));
	console.log(JSON.stringify(results));
	if (reports.some((report) => report.errorCount > 0)) process.exitCode = 1;
} catch (cause) {
	console.error(cause);
	process.exitCode = 2;
}
