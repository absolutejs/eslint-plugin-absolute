const BUTTON_OPEN_PATTERN = /<button\b/giu;
const BUTTON_CLOSE = "</button";
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
const NOT_FOUND = -1;

type ExposedIcon = { openingEnd: number; start: number };

export type ButtonAccessibilityFinding = {
	buttonStart: number;
	exposedIcons: ExposedIcon[];
	missingAccessibleName: boolean;
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
	for (const match of source.matchAll(BUTTON_OPEN_PATTERN)) {
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
			buttonStart,
			exposedIcons: exposedIcons(inner, openingEnd + 1),
			missingAccessibleName:
				!ACCESSIBLE_NAME_PATTERN.test(opening) &&
				!hasReadableContent(inner)
		});
	}

	return findings;
};
