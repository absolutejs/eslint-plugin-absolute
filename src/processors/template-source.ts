import type { Linter } from "eslint";

const WRAPPER_LINES = 1;

export const templateSourceProcessor: Linter.Processor = {
	meta: { name: "template-source", version: "1" },
	postprocess(messageLists) {
		return (messageLists[0] ?? []).map((message) => ({
			...message,
			endLine:
				message.endLine === undefined
					? undefined
					: Math.max(1, message.endLine - WRAPPER_LINES),
			line: Math.max(1, (message.line ?? 1) - WRAPPER_LINES)
		}));
	},
	preprocess(text, filename) {
		return [
			{
				filename: `${filename}.js`,
				text: `/*\n${text.replaceAll("*/", "* /")}\n*/`
			}
		];
	},
	supportsAutofix: false
};
