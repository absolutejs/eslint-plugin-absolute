const BUTTON_OPEN_PATTERN = /<button\b/giu;
const BUTTON_CLOSE = "</button";
const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//gu;
const HTML_COMMENT_SOURCE_PATTERN = /<!--[\s\S]*?-->/gu;
const MATERIAL_ICON_OPEN_PATTERN =
	/<(?:i|span)\b(?=[^>]*(?:class|className)\s*=\s*(?:"[^"]*\bmaterial-icons(?:-[\w-]+)?\b[^"]*"|'[^']*\bmaterial-icons(?:-[\w-]+)?\b[^']*'|\{["'`][^}"'`]*\bmaterial-icons(?:-[\w-]+)?\b[^}"'`]*["'`]\}))[^>]*>/giu;
const MATERIAL_ICON_ELEMENT_PATTERN =
	/<(i|span)\b(?=[^>]*(?:class|className)\s*=\s*(?:"[^"]*\bmaterial-icons(?:-[\w-]+)?\b[^"]*"|'[^']*\bmaterial-icons(?:-[\w-]+)?\b[^']*'|\{["'`][^}"'`]*\bmaterial-icons(?:-[\w-]+)?\b[^}"'`]*["'`]\}))[^>]*>[\s\S]*?<\/\1\s*>/giu;
const ACCESSIBLE_NAME_PATTERN =
	/(?:^|\s)(?::|v-bind:|\[attr\.)?aria-(?:label|labelledby)(?:\])?\s*=/iu;
const ARIA_HIDDEN_TRUE_PATTERN =
	/(?:^|\s)(?::|v-bind:|\[attr\.)?aria-hidden(?:\])?\s*=\s*(?:"true"|'true'|\{true\}|"\{\{true\}\}")/iu;
const TAG_PATTERN = /<[^>]*>/gu;
const COMMENT_PATTERN = /<!--(?:[\s\S]*?)-->/gu;
const HTML_ENTITY_PATTERN = /&(?:nbsp|#160|#xA0);/giu;
const READABLE_PATTERN = /[\p{L}\p{N}]/u;
const TEMPLATE_PROCESSOR_PREFIX = "/* absolute-template-source\n";
const STYLE_BLOCK_PATTERN = /<style\b[^>]*>[\s\S]*?<\/style\s*>/giu;
const TITLE_PATTERN = /(?:^|\s)((?::|v-bind:)?title)\s*=\s*("[^"]*"|'[^']*')/iu;
const NOT_FOUND = -1;

type ExposedIcon = { openingEnd: number; start: number };

export type ButtonAccessibilityFinding = {
	accessibleNameInsertion: string | null;
	buttonOpeningEnd: number;
	buttonStart: number;
	exposedIcons: ExposedIcon[];
	missingAccessibleName: boolean;
};

const preserveLines = (value: string) => value.replace(/[^\n]/gu, " ");

const maskIgnoredSource = (source: string) =>
	(source.startsWith(TEMPLATE_PROCESSOR_PREFIX)
		? source
		: source.replace(BLOCK_COMMENT_PATTERN, preserveLines)
	)
		.replace(STYLE_BLOCK_PATTERN, preserveLines)
		.replace(HTML_COMMENT_SOURCE_PATTERN, preserveLines);

const accessibleNameInsertion = (opening: string) => {
	const match = TITLE_PATTERN.exec(opening);
	if (!match) return null;
	const [, titleName, titleValue] = match;
	if (!titleName || !titleValue) return null;
	const attributeName =
		titleName.startsWith(":") || titleName.startsWith("v-bind:")
			? ":aria-label"
			: "aria-label";

	return ` ${attributeName}=${titleValue}`;
};

// The state machine must track quoted and braced attribute values while finding `>`.
/* eslint-disable absolute/max-depth-extended */
const tagEnd = (source: string, start: number) => {
	let quote: "'" | '"' | "`" | null = null;
	let braceDepth = 0;
	for (let index = start; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			if (character === quote && source[index - 1] !== "\\") quote = null;
			continue;
		}
		if (character === "'" || character === '"' || character === "`") {
			quote = character;
			continue;
		}
		if (character === "{") braceDepth += 1;
		else if (character === "}" && braceDepth > 0) braceDepth -= 1;
		else if (character === ">" && braceDepth === 0) return index;
	}

	return NOT_FOUND;
};
/* eslint-enable absolute/max-depth-extended */

const hasReadableContent = (inner: string) => {
	const withoutIcons = inner.replace(MATERIAL_ICON_ELEMENT_PATTERN, "");
	const text = withoutIcons
		.replace(COMMENT_PATTERN, "")
		.replace(TAG_PATTERN, "")
		.replace(HTML_ENTITY_PATTERN, "")
		.trim();

	return READABLE_PATTERN.test(text);
};

const exposedIcons = (inner: string, innerOffset: number) => {
	const icons: ExposedIcon[] = [];
	for (const match of inner.matchAll(MATERIAL_ICON_OPEN_PATTERN)) {
		const [opening] = match;
		if (ARIA_HIDDEN_TRUE_PATTERN.test(opening)) continue;
		const start = innerOffset + (match.index ?? 0);
		icons.push({ openingEnd: start + opening.length - 1, start });
	}

	return icons;
};

export const scanButtonAccessibility = (source: string) => {
	const findings: ButtonAccessibilityFinding[] = [];
	for (const match of maskIgnoredSource(source).matchAll(
		BUTTON_OPEN_PATTERN
	)) {
		const buttonStart = match.index ?? 0;
		const openingEnd = tagEnd(source, buttonStart);
		if (openingEnd < 0) continue;
		const opening = source.slice(buttonStart, openingEnd + 1);
		const selfClosing = /\/\s*>$/u.test(opening);
		const closeStart = selfClosing
			? openingEnd + 1
			: source.toLowerCase().indexOf(BUTTON_CLOSE, openingEnd + 1);
		const innerEnd = closeStart < 0 ? openingEnd + 1 : closeStart;
		const inner = source.slice(openingEnd + 1, innerEnd);
		findings.push({
			accessibleNameInsertion: accessibleNameInsertion(opening),
			buttonOpeningEnd: openingEnd,
			buttonStart,
			exposedIcons: exposedIcons(inner, openingEnd + 1),
			missingAccessibleName:
				!ACCESSIBLE_NAME_PATTERN.test(opening) &&
				!hasReadableContent(inner)
		});
	}

	return findings;
};
