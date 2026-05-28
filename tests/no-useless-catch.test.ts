import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUselessCatch } from "../src/rules/no-useless-catch";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2020,
		sourceType: "module"
	}
});

ruleTester.run("no-useless-catch", noUselessCatch, {
	invalid: [
		{
			code: `try { work(); } catch (error) {}`,
			errors: [{ messageId: "uselessCatch" }],
			name: "empty catch"
		},
		{
			code: `try { work(); } catch (error) { /* ignore */ }`,
			errors: [{ messageId: "uselessCatch" }],
			name: "comment-only catch"
		},
		{
			code: `try { work(); } catch (error) { ; }`,
			errors: [{ messageId: "uselessCatch" }],
			name: "empty statement catch"
		},
		{
			code: `try { work(); } catch (error) { error; }`,
			errors: [{ messageId: "uselessCatch" }],
			name: "bare catch parameter expression"
		},
		{
			code: `try { work(); } catch (error) { error.message; }`,
			errors: [{ messageId: "uselessCatch" }],
			name: "bare member expression"
		},
		{
			code: `try { work(); } catch (error) { void error; }`,
			errors: [{ messageId: "uselessCatch" }],
			name: "void expression"
		}
	],
	valid: [
		{
			code: `try { work(); } catch (error) { throw error; }`,
			name: "rethrown error"
		},
		{
			code: `try { work(); } catch (error) { console.error(error); }`,
			name: "logged error"
		},
		{
			code: `try { work(); } catch (error) { return null; }`,
			name: "fallback return"
		},
		{
			code: `try { work(); } catch (error) { failed = true; }`,
			name: "assignment side effect"
		},
		{
			code: `try { work(); } catch (error) { retries++; }`,
			name: "update side effect"
		},
		{
			code: `try { work(); } catch (error) { cleanup(); throw error; }`,
			name: "cleanup and rethrow"
		}
	]
});

console.log("no-useless-catch: All tests passed!");
