import { RuleTester } from "@typescript-eslint/rule-tester";
import { springNamingConvention } from "../src/rules/spring-naming-convention";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("spring-naming-convention", springNamingConvention, {
	valid: [
		{
			name: "useSpring with correct naming",
			code: `const [fadeSprings, fadeApi] = useSpring(() => ({}));`
		},
		{
			name: "useSprings with correct plural naming",
			code: `const [itemsSprings, itemsApi] = useSprings(3, () => ({}));`
		},
		{
			name: "non-spring hook (should be ignored)",
			code: `const [state, setState] = useState(0);`
		},
		{
			name: "useSpring without array destructuring (ignored)",
			code: `const springs = useSpring(() => ({}));`
		}
	],
	invalid: [
		{
			name: "useSpring first var doesn't end with Springs",
			code: `const [fade, fadeApi] = useSpring(() => ({}));`,
			errors: [{ messageId: "firstMustEndWithSprings" }]
		},
		{
			name: "useSpring second var doesn't match expected pattern",
			code: `const [fadeSprings, fadeController] = useSpring(() => ({}));`,
			errors: [{ messageId: "secondMustMatch" }]
		},
		{
			name: "useSprings first var not plural before Springs",
			code: `const [itemSprings, itemApi] = useSprings(3, () => ({}));`,
			errors: [{ messageId: "pluralRequired" }]
		},
		{
			name: "useSpring empty base name (just 'Springs')",
			code: `const [Springs, api] = useSpring(() => ({}));`,
			errors: [{ messageId: "firstMustHaveBase" }]
		}
	]
});

console.log("spring-naming-convention: All tests passed!");
