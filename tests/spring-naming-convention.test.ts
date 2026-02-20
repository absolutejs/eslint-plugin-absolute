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
		}
	]
});

console.log("spring-naming-convention: All tests passed!");
