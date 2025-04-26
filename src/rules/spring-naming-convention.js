export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Enforce correct naming for useSpring and useSprings hook destructuring",
			category: "Stylistic Issues",
			recommended: false
		},
		schema: []
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				if (
					node.init &&
					node.init.type === "CallExpression" &&
					node.init.callee &&
					node.init.callee.type === "Identifier" &&
					(node.init.callee.name === "useSpring" ||
						node.init.callee.name === "useSprings")
				) {
					const hookName = node.init.callee.name;
					if (node.id && node.id.type === "ArrayPattern") {
						const elements = node.id.elements;
						if (elements.length < 2) {
							return;
						}
						const firstElem = elements[0];
						const secondElem = elements[1];
						if (
							!firstElem ||
							firstElem.type !== "Identifier" ||
							!secondElem ||
							secondElem.type !== "Identifier"
						) {
							return;
						}
						const firstName = firstElem.name;
						const secondName = secondElem.name;
						if (hookName === "useSpring") {
							if (!firstName.endsWith("Springs")) {
								context.report({
									node: firstElem,
									message:
										"The first variable from useSpring must end with 'Springs'."
								});
							} else {
								const base = firstName.slice(
									0,
									-"Springs".length
								);
								if (!base) {
									context.report({
										node: firstElem,
										message:
											"The first variable must have a non-empty name before 'Springs'."
									});
									return;
								}
								const expectedSecond = base + "Api";
								if (secondName !== expectedSecond) {
									context.report({
										node: secondElem,
										message: `The second variable from useSpring must be named '${expectedSecond}'.`
									});
								}
							}
						} else if (hookName === "useSprings") {
							if (!firstName.endsWith("Springs")) {
								context.report({
									node: firstElem,
									message:
										"The first variable from useSprings must end with 'Springs'."
								});
							} else {
								const basePlural = firstName.slice(
									0,
									-"Springs".length
								);
								if (!basePlural) {
									context.report({
										node: firstElem,
										message:
											"The first variable must have a non-empty name before 'Springs'."
									});
									return;
								}
								if (!basePlural.endsWith("s")) {
									context.report({
										node: firstElem,
										message:
											"The first variable for useSprings should be a plural name (ending with an 's') before 'Springs'."
									});
								} else {
									const expectedSecond = basePlural + "Api";
									if (secondName !== expectedSecond) {
										context.report({
											node: secondElem,
											message: `The second variable from useSprings must be named '${expectedSecond}'.`
										});
									}
								}
							}
						}
					}
				}
			}
		};
	}
};
