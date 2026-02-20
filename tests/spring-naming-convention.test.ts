import { RuleTester } from "@typescript-eslint/rule-tester";
import { springNamingConvention } from "../src/rules/spring-naming-convention";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("spring-naming-convention", springNamingConvention, {
	invalid: [
		{
			code: `const [fade, fadeApi] = useSpring(() => ({}));`,
			errors: [{ messageId: "firstMustEndWithSprings" }],
			name: "useSpring first var doesn't end with Springs"
		},
		{
			code: `const [fadeSprings, fadeController] = useSpring(() => ({}));`,
			errors: [{ messageId: "secondMustMatch" }],
			name: "useSpring second var doesn't match expected pattern"
		},
		{
			code: `const [itemSprings, itemApi] = useSprings(3, () => ({}));`,
			errors: [{ messageId: "pluralRequired" }],
			name: "useSprings first var not plural before Springs"
		},
		{
			code: `const [Springs, api] = useSpring(() => ({}));`,
			errors: [{ messageId: "firstMustHaveBase" }],
			name: "useSpring empty base name (just 'Springs')"
		},
		{
			code: `const [fade, fadeApi] = useSprings(3, () => ({}));`,
			errors: [{ messageId: "firstMustEndWithSprings" }],
			name: "useSprings first var doesn't end with Springs"
		},
		{
			code: `const [Springs, api] = useSprings(3, () => ({}));`,
			errors: [{ messageId: "firstMustHaveBase" }],
			name: "useSprings empty base name (just 'Springs')"
		},
		{
			code: `const [itemsSprings, wrongName] = useSprings(3, () => ({}));`,
			errors: [{ messageId: "secondMustMatch" }],
			name: "useSprings second var doesn't match expected pattern"
		}
	],
	valid: [
		{
			code: `const [fadeSprings, fadeApi] = useSpring(() => ({}));`,
			name: "useSpring with correct naming"
		},
		{
			code: `const [itemsSprings, itemsApi] = useSprings(3, () => ({}));`,
			name: "useSprings with correct plural naming"
		},
		{
			code: `const [state, setState] = useState(0);`,
			name: "non-spring hook (should be ignored)"
		},
		{
			code: `const springs = useSpring(() => ({}));`,
			name: "useSpring without array destructuring (ignored)"
		},
		{
			code: `const [fadeSprings] = useSpring(() => ({}));`,
			name: "single element array destructuring (ignored, less than 2 elements)"
		}
	]
});

console.log("spring-naming-convention: All tests passed!");
