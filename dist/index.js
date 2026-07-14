// @bun
// src/rules/angular-one-feature-per-file.ts
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

// src/createRule.ts
import { ESLintUtils } from "@typescript-eslint/utils";
var createRule = ESLintUtils.RuleCreator((name) => `https://absolutejs.com/documentation/eslint-${name}`);

// src/rules/angular-one-feature-per-file.ts
var FEATURE_DECORATOR_NAMES = new Set([
  "Component",
  "Directive",
  "Injectable",
  "NgModule",
  "Pipe"
]);
var getDecoratorName = (decorator) => {
  const { expression } = decorator;
  if (expression.type === AST_NODE_TYPES.CallExpression && expression.callee.type === AST_NODE_TYPES.Identifier) {
    return expression.callee.name;
  }
  if (expression.type === AST_NODE_TYPES.Identifier) {
    return expression.name;
  }
  return null;
};
var isFeatureClass = (node) => {
  if (!node.decorators || node.decorators.length === 0)
    return false;
  return node.decorators.some((decorator) => {
    const name = getDecoratorName(decorator);
    return name !== null && FEATURE_DECORATOR_NAMES.has(name);
  });
};
var angularOneFeaturePerFile = createRule({
  create(context) {
    const seenFeatures = [];
    return {
      ClassDeclaration(node) {
        if (!isFeatureClass(node))
          return;
        seenFeatures.push(node);
        if (seenFeatures.length === 1)
          return;
        context.report({
          messageId: "multiFeature",
          node: node.id ?? node
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Disallow defining more than one Angular feature class (@Component, @Directive, @Pipe, @Injectable, @NgModule) per file. Mirrors the Angular Style Guide\'s Single Responsibility / Rule of One. Test and Storybook files legitimately define stub/host classes alongside the subject under test \u2014 disable this rule for those files via an ESLint override (e.g., `{ files: ["**/*.spec.ts", "**/*.stories.ts"], rules: { "absolute/angular-one-feature-per-file": "off" } }`).'
    },
    messages: {
      multiFeature: "Only one Angular feature class is allowed per file. Move this class into its own file (Angular Style Guide: Single Responsibility / Rule of One)."
    },
    schema: [],
    type: "problem"
  },
  name: "angular-one-feature-per-file"
});

// src/rules/heading-order.ts
var DEFAULT_MAX_FIRST_LEVEL = 6;
var HEADING_NAME_PATTERN = /^h([1-6])$/;
var headingLevel = (node) => {
  const match = HEADING_NAME_PATTERN.exec(node.rawName.toLowerCase());
  if (!match)
    return null;
  const [, level] = match;
  return level ? Number(level) : null;
};
var headingOrder = createRule({
  create(context) {
    const [options] = context.options;
    const maxFirstLevel = options?.maxFirstLevel ?? DEFAULT_MAX_FIRST_LEVEL;
    const { parserServices } = context.sourceCode;
    if (!parserServices || !("defineTemplateBodyVisitor" in parserServices) || typeof parserServices.defineTemplateBodyVisitor !== "function") {
      return {};
    }
    let previousLevel = null;
    return parserServices.defineTemplateBodyVisitor({
      VElement(node) {
        const currentLevel = headingLevel(node);
        if (currentLevel === null)
          return;
        if (previousLevel === null && currentLevel > maxFirstLevel) {
          context.report({
            data: {
              actual: currentLevel,
              maximum: maxFirstLevel
            },
            loc: node.loc,
            messageId: "firstHeadingTooDeep"
          });
        }
        if (previousLevel !== null && currentLevel > previousLevel + 1) {
          context.report({
            data: {
              actual: currentLevel,
              previous: previousLevel
            },
            loc: node.loc,
            messageId: "skippedHeadingLevel"
          });
        }
        previousLevel = currentLevel;
      }
    });
  },
  defaultOptions: [{ maxFirstLevel: DEFAULT_MAX_FIRST_LEVEL }],
  meta: {
    docs: {
      description: "Prevent skipped heading levels in Vue templates, with an optional limit for the first heading."
    },
    messages: {
      firstHeadingTooDeep: "The first heading is h{{actual}}. Start this template at h{{maximum}} or higher so it can join a valid document outline.",
      skippedHeadingLevel: "Heading order skips from h{{previous}} to h{{actual}}. Use the next sequential heading level."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          maxFirstLevel: {
            maximum: 6,
            minimum: 1,
            type: "integer"
          }
        },
        type: "object"
      }
    ],
    type: "problem"
  },
  name: "heading-order"
});

// src/rules/no-nested-jsx-return.ts
import { AST_NODE_TYPES as AST_NODE_TYPES2 } from "@typescript-eslint/utils";
var noNestedJSXReturn = createRule({
  create(context) {
    const isJSX = (node) => node !== null && node !== undefined && (node.type === AST_NODE_TYPES2.JSXElement || node.type === AST_NODE_TYPES2.JSXFragment);
    const getLeftmostJSXIdentifier = (name) => {
      let current = name;
      while (current.type === AST_NODE_TYPES2.JSXMemberExpression) {
        current = current.object;
      }
      if (current.type === AST_NODE_TYPES2.JSXIdentifier) {
        return current;
      }
      return null;
    };
    const isJSXComponentElement = (node) => {
      if (!node || node.type !== AST_NODE_TYPES2.JSXElement) {
        return false;
      }
      const opening = node.openingElement;
      const nameNode = opening.name;
      if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
        return /^[A-Z]/.test(nameNode.name);
      }
      const leftmost = getLeftmostJSXIdentifier(nameNode);
      if (!leftmost) {
        return false;
      }
      return /^[A-Z]/.test(leftmost.name);
    };
    const hasNoMeaningfulChildren = (children) => {
      const filtered = children.filter((child) => {
        if (child.type === AST_NODE_TYPES2.JSXText) {
          return child.value.trim() !== "";
        }
        return true;
      });
      return filtered.length === 0;
    };
    const isSingularJSXReturn = (node) => {
      if (!isJSX(node))
        return false;
      const children = node.children.filter((child2) => {
        if (child2.type === AST_NODE_TYPES2.JSXText) {
          return child2.value.trim() !== "";
        }
        return true;
      });
      if (children.length === 0) {
        return true;
      }
      if (children.length !== 1) {
        return false;
      }
      const [child] = children;
      if (!child) {
        return false;
      }
      if (child.type === AST_NODE_TYPES2.JSXElement || child.type === AST_NODE_TYPES2.JSXFragment) {
        return hasNoMeaningfulChildren(child.children);
      }
      return true;
    };
    const functionStack = [];
    const pushFunction = (node) => {
      functionStack.push(node);
    };
    const popFunction = () => {
      functionStack.pop();
    };
    return {
      "ArrowFunctionExpression > JSXElement"(node) {
        if (functionStack.length <= 1) {
          return;
        }
        if (!isJSXComponentElement(node) && !isSingularJSXReturn(node)) {
          context.report({
            messageId: "nestedArrowJSX",
            node
          });
        }
      },
      "ArrowFunctionExpression > JSXFragment"(node) {
        if (functionStack.length <= 1) {
          return;
        }
        if (!isSingularJSXReturn(node)) {
          context.report({
            messageId: "nestedArrowFragment",
            node
          });
        }
      },
      "ArrowFunctionExpression:exit"() {
        popFunction();
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        pushFunction(node);
      },
      "FunctionDeclaration:exit"() {
        popFunction();
      },
      "FunctionExpression:exit"() {
        popFunction();
      },
      ReturnStatement(node) {
        if (functionStack.length <= 1) {
          return;
        }
        const { argument } = node;
        if (!isJSX(argument)) {
          return;
        }
        if (!isJSXComponentElement(argument) && !isSingularJSXReturn(argument)) {
          context.report({
            messageId: "nestedFunctionJSX",
            node
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow nested functions that return non-component, non-singular JSX to enforce one component per file"
    },
    messages: {
      nestedArrowFragment: "Nested arrow function returning a non-singular JSX fragment detected. Extract it into its own component.",
      nestedArrowJSX: "Nested arrow function returning non-component, non-singular JSX detected. Extract it into its own component.",
      nestedFunctionJSX: "Nested function returning non-component, non-singular JSX detected. Extract it into its own component."
    },
    schema: [],
    type: "problem"
  },
  name: "no-nested-jsx-return"
});

// src/rules/explicit-object-types.ts
var explicitObjectTypes = createRule({
  create(context) {
    const isObjectLiteral = (node) => node !== null && node !== undefined && node.type === "ObjectExpression";
    return {
      VariableDeclarator(node) {
        if (!node.init)
          return;
        if (node.id.type === "Identifier" && node.id.typeAnnotation)
          return;
        if (isObjectLiteral(node.init) && node.id.type === "Identifier") {
          context.report({
            messageId: "objectLiteralNeedsType",
            node: node.id
          });
          return;
        }
        if (node.init.type !== "ArrayExpression") {
          return;
        }
        const hasObjectLiteral = node.init.elements.some((element) => {
          if (!element || element.type === "SpreadElement")
            return false;
          return isObjectLiteral(element);
        });
        if (hasObjectLiteral && node.id.type === "Identifier") {
          context.report({
            messageId: "arrayOfObjectLiteralsNeedsType",
            node: node.id
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Require explicit type annotations for object literals and arrays of object literals"
    },
    messages: {
      arrayOfObjectLiteralsNeedsType: "Array of object literals must have an explicit type annotation.",
      objectLiteralNeedsType: "Object literal must have an explicit type annotation."
    },
    schema: [],
    type: "problem"
  },
  name: "explicit-object-types"
});

// src/rules/sort-keys-fixable.ts
import * as ts from "typescript";
var SORT_BEFORE = -1;
var PURE_CONSTRUCTORS = new Set(["Date"]);
var PURE_GLOBAL_IDENTIFIERS = new Set([
  "Array",
  "BigInt",
  "Boolean",
  "Date",
  "Function",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "URL",
  "globalThis",
  "undefined"
]);
var PURE_GLOBAL_FUNCTIONS = new Set([
  "Boolean",
  "Number",
  "String",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt"
]);
var PURE_MEMBER_METHODS = new Set([
  "toString",
  "valueOf",
  "at",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "endsWith",
  "includes",
  "indexOf",
  "lastIndexOf",
  "match",
  "matchAll",
  "normalize",
  "padEnd",
  "padStart",
  "repeat",
  "replace",
  "replaceAll",
  "search",
  "slice",
  "split",
  "startsWith",
  "substr",
  "substring",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
  "exec",
  "test",
  "toExponential",
  "toFixed",
  "toPrecision",
  "isInteger",
  "isSafeInteger",
  "getDate",
  "getDay",
  "getFullYear",
  "getHours",
  "getMilliseconds",
  "getMinutes",
  "getMonth",
  "getSeconds",
  "getTime",
  "getTimezoneOffset",
  "getUTCDate",
  "getUTCDay",
  "getUTCFullYear",
  "getUTCHours",
  "getUTCMilliseconds",
  "getUTCMinutes",
  "getUTCMonth",
  "getUTCSeconds",
  "toDateString",
  "toISOString",
  "toJSON",
  "toLocaleDateString",
  "toLocaleString",
  "toLocaleTimeString",
  "toTimeString",
  "toUTCString",
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "ceil",
  "clz32",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "fround",
  "hypot",
  "log",
  "log10",
  "log1p",
  "log2",
  "max",
  "min",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc",
  "entries",
  "fromEntries",
  "getOwnPropertyNames",
  "getOwnPropertySymbols",
  "getPrototypeOf",
  "hasOwn",
  "isArray",
  "keys",
  "values",
  "concat",
  "join",
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "sort",
  "parse",
  "stringify"
]);
var hasDuplicateNames = (names) => {
  const seen = new Set;
  const nonNullNames = names.flatMap((name) => name === null ? [] : [name]);
  for (const name of nonNullNames) {
    if (seen.has(name)) {
      return true;
    }
    seen.add(name);
  }
  return false;
};
var getStaticPropertyKeyName = (property) => {
  if (property.key.type === "Identifier")
    return property.key.name;
  if (property.key.type === "Literal") {
    const { value } = property.key;
    return typeof value === "string" ? value : String(value);
  }
  return null;
};
var isAccessorPairOnly = (kinds) => kinds.length === 2 && kinds.includes("get") && kinds.includes("set");
var hasDuplicatePropertyNames = (properties) => {
  const kindsByName = new Map;
  properties.forEach((property) => {
    if (property.type !== "Property")
      return;
    const keyName = getStaticPropertyKeyName(property);
    if (keyName === null)
      return;
    const kinds = kindsByName.get(keyName) ?? [];
    kinds.push(property.kind);
    kindsByName.set(keyName, kinds);
  });
  return [...kindsByName.values()].some((kinds) => kinds.length > 1 && !isAccessorPairOnly(kinds));
};
var sortKeysFixable = createRule({
  create(context) {
    const { sourceCode } = context;
    const [option] = context.options;
    const topLevelBindings = new Map;
    const pureFunctionCache = new Map;
    const pureFunctionInProgress = new Set;
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
    const pureImports = new Set(option && Array.isArray(option.pureImports) ? option.pureImports : []);
    const parserServices = sourceCode.parserServices ?? null;
    const tsProgram = parserServices && "program" in parserServices ? parserServices.program : null;
    const tsChecker = tsProgram ? tsProgram.getTypeChecker() : null;
    const esTreeNodeToTSNodeMap = parserServices && "esTreeNodeToTSNodeMap" in parserServices ? parserServices.esTreeNodeToTSNodeMap : null;
    const importedCallPurityCache = new Map;
    const importedCallPurityInProgress = new Set;
    const compareKeys = (keyLeft, keyRight) => {
      let left = keyLeft;
      let right = keyRight;
      if (!caseSensitive) {
        left = left.toLowerCase();
        right = right.toLowerCase();
      }
      if (natural) {
        return left.localeCompare(right, undefined, {
          numeric: true
        });
      }
      return left.localeCompare(right);
    };
    const addImportBindings = (statement) => {
      if (statement.specifiers.length === 0) {
        return;
      }
      for (const specifier of statement.specifiers) {
        topLevelBindings.set(specifier.local.name, {
          kind: "import"
        });
      }
    };
    const addVariableBinding = (declaration) => {
      if (declaration.id.type !== "Identifier" || !declaration.init) {
        return;
      }
      if (declaration.init.type === "ArrowFunctionExpression" || declaration.init.type === "FunctionExpression") {
        topLevelBindings.set(declaration.id.name, {
          kind: "function",
          node: declaration.init
        });
        return;
      }
      topLevelBindings.set(declaration.id.name, {
        kind: "value",
        node: declaration.init
      });
    };
    const addTopLevelBindings = (statement) => {
      let inner = statement;
      if (inner.type === "ExportNamedDeclaration" && inner.declaration) {
        inner = inner.declaration;
      } else if (inner.type === "ExportDefaultDeclaration" && (inner.declaration.type === "FunctionDeclaration" || inner.declaration.type === "ClassDeclaration")) {
        inner = inner.declaration;
      }
      if (inner.type === "ImportDeclaration") {
        addImportBindings(inner);
        return;
      }
      if (inner.type === "FunctionDeclaration" && inner.id) {
        topLevelBindings.set(inner.id.name, {
          kind: "function",
          node: inner
        });
        return;
      }
      if (inner.type !== "VariableDeclaration" || inner.kind !== "const") {
        return;
      }
      for (const declaration of inner.declarations) {
        addVariableBinding(declaration);
      }
    };
    for (const statement of sourceCode.ast.body) {
      addTopLevelBindings(statement);
    }
    const addBoundIdentifiers = (node, stableLocals) => {
      if (!node) {
        return;
      }
      switch (node.type) {
        case "Identifier":
          stableLocals.add(node.name);
          return;
        case "AssignmentPattern":
          addBoundIdentifiers(node.left, stableLocals);
          return;
        case "RestElement":
          addBoundIdentifiers(node.argument, stableLocals);
          return;
        case "ArrayPattern":
          for (const element of node.elements.filter(Boolean)) {
            addBoundIdentifiers(element, stableLocals);
          }
          break;
        case "ObjectPattern":
          for (const property of node.properties) {
            const bindingNode = property.type === "RestElement" ? property.argument : property.value;
            addBoundIdentifiers(bindingNode, stableLocals);
          }
          break;
        default:
          break;
      }
    };
    const addFunctionParamBindings = (functionNode, stableLocals) => {
      for (const parameter of functionNode.params) {
        addBoundIdentifiers(parameter, stableLocals);
      }
    };
    const addAncestorConstBindings = (ancestor, node, stableLocals) => {
      const addDeclarationBindings = (statement) => {
        let inner = statement;
        if (inner.type === "ExportNamedDeclaration" && inner.declaration) {
          inner = inner.declaration;
        }
        if (inner.type !== "VariableDeclaration") {
          return;
        }
        for (const declaration of inner.declarations) {
          addBoundIdentifiers(declaration.id, stableLocals);
        }
      };
      for (const statement of ancestor.body) {
        if (statement.range[0] >= node.range[0]) {
          return;
        }
        addDeclarationBindings(statement);
      }
    };
    const addAncestorBindingsForNode = (ancestor, node, stableLocals) => {
      if (ancestor.type !== "Program" && ancestor.type !== "BlockStatement") {
        return;
      }
      addAncestorConstBindings(ancestor, node, stableLocals);
    };
    const addFunctionBindingsForAncestor = (ancestor, stableLocals) => {
      if (ancestor.type !== "FunctionDeclaration" && ancestor.type !== "FunctionExpression" && ancestor.type !== "ArrowFunctionExpression") {
        return;
      }
      addFunctionParamBindings(ancestor, stableLocals);
    };
    const addForStatementBindings = (ancestor, stableLocals) => {
      if (ancestor.type !== "ForOfStatement" && ancestor.type !== "ForInStatement" && ancestor.type !== "ForStatement") {
        return;
      }
      const left = ancestor.type === "ForStatement" ? ancestor.init : ancestor.left;
      if (!left)
        return;
      if (left.type !== "VariableDeclaration") {
        addBoundIdentifiers(left, stableLocals);
        return;
      }
      left.declarations.forEach((declaration) => addBoundIdentifiers(declaration.id, stableLocals));
    };
    const addCatchClauseBindings = (ancestor, stableLocals) => {
      if (ancestor.type !== "CatchClause" || !ancestor.param)
        return;
      addBoundIdentifiers(ancestor.param, stableLocals);
    };
    const getStableLocalsForNode = (node) => {
      const stableLocals = new Set;
      const ancestors = sourceCode.getAncestors(node);
      for (const ancestor of ancestors) {
        addFunctionBindingsForAncestor(ancestor, stableLocals);
        addForStatementBindings(ancestor, stableLocals);
        addCatchClauseBindings(ancestor, stableLocals);
      }
      for (const ancestor of ancestors) {
        addAncestorBindingsForNode(ancestor, node, stableLocals);
      }
      stableLocals.add("this");
      return stableLocals;
    };
    const getStaticMemberName = (memberExpression) => {
      if (!memberExpression.computed && memberExpression.property.type === "Identifier") {
        return memberExpression.property.name;
      }
      if (memberExpression.computed && memberExpression.property.type === "Literal" && typeof memberExpression.property.value === "string") {
        return memberExpression.property.value;
      }
      return null;
    };
    const isStableIdentifier = (name, stableLocals) => {
      if (PURE_GLOBAL_IDENTIFIERS.has(name)) {
        return true;
      }
      if (stableLocals.has(name)) {
        return true;
      }
      const binding = topLevelBindings.get(name);
      if (!binding) {
        return false;
      }
      if (binding.kind === "import") {
        return true;
      }
      if (binding.kind === "value") {
        return isPureRuntimeExpression(binding.node, stableLocals);
      }
      return false;
    };
    const isPureLocalVariableStatement = (statement, stableLocals) => {
      for (const declaration of statement.declarations) {
        if (declaration.init && !isPureRuntimeExpression(declaration.init, stableLocals)) {
          return false;
        }
        addBoundIdentifiers(declaration.id, stableLocals);
      }
      return true;
    };
    const isPureLocalAssignment = (expression, stableLocals) => {
      if (expression.type !== "AssignmentExpression")
        return false;
      if (expression.operator !== "=") {}
      if (expression.left.type !== "Identifier")
        return false;
      if (!stableLocals.has(expression.left.name))
        return false;
      return isPureRuntimeExpression(expression.right, stableLocals);
    };
    const isPureFunctionStatement = (statement, stableLocals) => {
      if (statement.type === "ReturnStatement") {
        return !statement.argument || isPureRuntimeExpression(statement.argument, stableLocals);
      }
      if (statement.type === "VariableDeclaration") {
        return isPureLocalVariableStatement(statement, stableLocals);
      }
      if (statement.type === "ExpressionStatement") {
        return isPureLocalAssignment(statement.expression, stableLocals);
      }
      if (statement.type === "IfStatement") {
        if (!isPureRuntimeExpression(statement.test, stableLocals)) {
          return false;
        }
        if (!isPureFunctionBranch(statement.consequent, new Set(stableLocals))) {
          return false;
        }
        return !statement.alternate || isPureFunctionBranch(statement.alternate, new Set(stableLocals));
      }
      if (statement.type === "BlockStatement") {
        return isPureFunctionBody(statement, new Set(stableLocals));
      }
      return false;
    };
    const isPureFunctionBranch = (statement, stableLocals) => {
      if (statement.type === "BlockStatement") {
        return isPureFunctionBody(statement, stableLocals);
      }
      return isPureFunctionStatement(statement, stableLocals);
    };
    const isPureFunctionBody = (body, stableLocals) => {
      for (const statement of body.body) {
        if (!isPureFunctionStatement(statement, stableLocals)) {
          return false;
        }
      }
      return true;
    };
    const isPureTopLevelFunction = (functionNode) => {
      const cached = pureFunctionCache.get(functionNode);
      if (cached !== undefined) {
        return cached;
      }
      if (pureFunctionInProgress.has(functionNode)) {
        return false;
      }
      pureFunctionInProgress.add(functionNode);
      const stableLocals = new Set;
      addFunctionParamBindings(functionNode, stableLocals);
      const isPure = functionNode.body.type === "BlockStatement" ? isPureFunctionBody(functionNode.body, stableLocals) : isPureRuntimeExpression(functionNode.body, stableLocals);
      pureFunctionInProgress.delete(functionNode);
      pureFunctionCache.set(functionNode, isPure);
      return isPure;
    };
    const ASSIGNMENT_OPERATOR_KINDS = new Set([
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.MinusEqualsToken,
      ts.SyntaxKind.AsteriskEqualsToken,
      ts.SyntaxKind.AsteriskAsteriskEqualsToken,
      ts.SyntaxKind.SlashEqualsToken,
      ts.SyntaxKind.PercentEqualsToken,
      ts.SyntaxKind.AmpersandEqualsToken,
      ts.SyntaxKind.BarEqualsToken,
      ts.SyntaxKind.CaretEqualsToken,
      ts.SyntaxKind.LessThanLessThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken,
      ts.SyntaxKind.QuestionQuestionEqualsToken
    ]);
    const addTsBoundIdentifiers = (node, stableLocals) => {
      if (node.kind === ts.SyntaxKind.OmittedExpression) {
        return;
      }
      if (ts.isIdentifier(node)) {
        stableLocals.add(node.text);
        return;
      }
      if (ts.isBindingElement(node)) {
        addTsBoundIdentifiers(node.name, stableLocals);
        return;
      }
      if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
        node.elements.forEach((element) => addTsBoundIdentifiers(element, stableLocals));
      }
    };
    const getCalleeIdentifier = (callee) => {
      if (ts.isIdentifier(callee)) {
        return callee;
      }
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
        return callee.name;
      }
      return null;
    };
    const getTsCalleePath = (callee) => {
      if (ts.isParenthesizedExpression(callee)) {
        return getTsCalleePath(callee.expression);
      }
      if (ts.isIdentifier(callee)) {
        return callee.text;
      }
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
        const objectPath = getTsCalleePath(callee.expression);
        return objectPath === null ? null : `${objectPath}.${callee.name.text}`;
      }
      return null;
    };
    const getFunctionLikeFromDeclaration = (declaration) => {
      if (ts.isFunctionDeclaration(declaration)) {
        return declaration;
      }
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const init = declaration.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          return init;
        }
      }
      return null;
    };
    const isPureTsIdentifier = (identifier, stableLocals) => {
      const name = identifier.text;
      if (PURE_GLOBAL_IDENTIFIERS.has(name)) {
        return true;
      }
      if (stableLocals.has(name)) {
        return true;
      }
      if (!tsChecker) {
        return false;
      }
      const symbol = tsChecker.getSymbolAtLocation(identifier);
      if (!symbol) {
        return false;
      }
      const target = symbol.flags & ts.SymbolFlags.Alias ? tsChecker.getAliasedSymbol(symbol) : symbol;
      const declaration = target.declarations?.[0];
      if (!declaration) {
        return false;
      }
      if (declaration.getSourceFile().isDeclarationFile) {
        return pureImports.has(name);
      }
      if (ts.isVariableDeclaration(declaration) && declaration.initializer && declaration.parent && ts.isVariableDeclarationList(declaration.parent) && declaration.parent.flags & ts.NodeFlags.Const) {
        return isPureTsExpression(declaration.initializer, new Set);
      }
      if (ts.isVariableDeclaration(declaration) || ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration) || ts.isParameter(declaration) || ts.isBindingElement(declaration)) {
        return true;
      }
      return false;
    };
    const isPureTsLocalAssignment = (expression, stableLocals) => {
      if (!ts.isBinaryExpression(expression))
        return false;
      if (!ASSIGNMENT_OPERATOR_KINDS.has(expression.operatorToken.kind))
        return false;
      if (!ts.isIdentifier(expression.left))
        return false;
      if (!stableLocals.has(expression.left.text))
        return false;
      return isPureTsExpression(expression.right, stableLocals);
    };
    const isPureTsVariableStatement = (statement, stableLocals) => {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer && !isPureTsExpression(declaration.initializer, stableLocals)) {
          return false;
        }
        addTsBoundIdentifiers(declaration.name, stableLocals);
      }
      return true;
    };
    const isPureTsStatement = (statement, stableLocals) => {
      if (ts.isReturnStatement(statement)) {
        return !statement.expression || isPureTsExpression(statement.expression, stableLocals);
      }
      if (ts.isVariableStatement(statement)) {
        return isPureTsVariableStatement(statement, stableLocals);
      }
      if (ts.isExpressionStatement(statement)) {
        return isPureTsLocalAssignment(statement.expression, stableLocals);
      }
      if (ts.isIfStatement(statement)) {
        if (!isPureTsExpression(statement.expression, stableLocals)) {
          return false;
        }
        const branchScope = new Set(stableLocals);
        if (!isPureTsStatementOrBlock(statement.thenStatement, branchScope)) {
          return false;
        }
        if (statement.elseStatement && !isPureTsStatementOrBlock(statement.elseStatement, new Set(stableLocals))) {
          return false;
        }
        return true;
      }
      if (ts.isBlock(statement)) {
        return isPureTsBlock(statement, new Set(stableLocals));
      }
      return false;
    };
    const isPureTsStatementOrBlock = (statement, stableLocals) => {
      if (ts.isBlock(statement)) {
        return isPureTsBlock(statement, stableLocals);
      }
      return isPureTsStatement(statement, stableLocals);
    };
    const isPureTsBlock = (block, stableLocals) => {
      for (const statement of block.statements) {
        if (!isPureTsStatement(statement, stableLocals)) {
          return false;
        }
      }
      return true;
    };
    const isPureTsFunction = (func) => {
      const cached = importedCallPurityCache.get(func);
      if (cached !== undefined) {
        return cached;
      }
      if (importedCallPurityInProgress.has(func)) {
        return false;
      }
      importedCallPurityInProgress.add(func);
      const stableLocals = new Set;
      for (const parameter of func.parameters) {
        addTsBoundIdentifiers(parameter.name, stableLocals);
      }
      let pure = false;
      if (func.body) {
        pure = ts.isBlock(func.body) ? isPureTsBlock(func.body, stableLocals) : isPureTsExpression(func.body, stableLocals);
      }
      importedCallPurityInProgress.delete(func);
      importedCallPurityCache.set(func, pure);
      return pure;
    };
    const isPureTsCallExpression = (node, stableLocals) => {
      const argsArePure = node.arguments.every((argument) => {
        if (ts.isSpreadElement(argument)) {
          return isPureTsExpression(argument.expression, stableLocals);
        }
        return isPureTsExpression(argument, stableLocals);
      });
      if (!argsArePure) {
        return false;
      }
      const calleePath = getTsCalleePath(node.expression);
      if (calleePath !== null && pureImports.has(calleePath)) {
        return true;
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const memberName = node.expression.name.text;
        if (PURE_MEMBER_METHODS.has(memberName)) {
          return isPureTsExpression(node.expression.expression, stableLocals);
        }
      }
      const calleeId = getCalleeIdentifier(node.expression);
      if (!calleeId) {
        return false;
      }
      if (PURE_GLOBAL_FUNCTIONS.has(calleeId.text)) {
        return true;
      }
      if (!tsChecker) {
        return false;
      }
      const symbol = tsChecker.getSymbolAtLocation(calleeId);
      if (!symbol) {
        return false;
      }
      const target = symbol.flags & ts.SymbolFlags.Alias ? tsChecker.getAliasedSymbol(symbol) : symbol;
      const declaration = target.declarations?.[0];
      if (!declaration) {
        return false;
      }
      if (declaration.getSourceFile().isDeclarationFile) {
        return false;
      }
      const funcNode = getFunctionLikeFromDeclaration(declaration);
      if (!funcNode) {
        return false;
      }
      return isPureTsFunction(funcNode);
    };
    const isPureTsExpression = (node, stableLocals) => {
      if (!node) {
        return false;
      }
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
        return isPureTsExpression(node.expression, stableLocals);
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) {
        return true;
      }
      if (ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isClassExpression(node)) {
        return true;
      }
      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        return stableLocals.has("this");
      }
      if (ts.isIdentifier(node)) {
        return isPureTsIdentifier(node, stableLocals);
      }
      if (ts.isTemplateExpression(node)) {
        return node.templateSpans.every((span) => isPureTsExpression(span.expression, stableLocals));
      }
      if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
        return isPureTsExpression(node.operand, stableLocals);
      }
      if (ts.isTypeOfExpression(node) || ts.isVoidExpression(node)) {
        return isPureTsExpression(node.expression, stableLocals);
      }
      if (ts.isBinaryExpression(node)) {
        if (ASSIGNMENT_OPERATOR_KINDS.has(node.operatorToken.kind) || node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          return false;
        }
        return isPureTsExpression(node.left, stableLocals) && isPureTsExpression(node.right, stableLocals);
      }
      if (ts.isConditionalExpression(node)) {
        return isPureTsExpression(node.condition, stableLocals) && isPureTsExpression(node.whenTrue, stableLocals) && isPureTsExpression(node.whenFalse, stableLocals);
      }
      if (ts.isArrayLiteralExpression(node)) {
        return node.elements.every((element) => {
          if (ts.isSpreadElement(element)) {
            return isPureTsExpression(element.expression, stableLocals);
          }
          if (element.kind === ts.SyntaxKind.OmittedExpression) {
            return false;
          }
          return isPureTsExpression(element, stableLocals);
        });
      }
      if (ts.isObjectLiteralExpression(node)) {
        return node.properties.every((property) => {
          if (ts.isShorthandPropertyAssignment(property)) {
            return isPureTsIdentifier(property.name, stableLocals);
          }
          if (ts.isPropertyAssignment(property)) {
            if (ts.isComputedPropertyName(property.name)) {
              return false;
            }
            return isPureTsExpression(property.initializer, stableLocals);
          }
          if (ts.isMethodDeclaration(property)) {
            return !ts.isComputedPropertyName(property.name);
          }
          return false;
        });
      }
      if (ts.isPropertyAccessExpression(node)) {
        return isPureTsExpression(node.expression, stableLocals);
      }
      if (ts.isElementAccessExpression(node)) {
        return isPureTsExpression(node.expression, stableLocals) && isPureTsExpression(node.argumentExpression, stableLocals);
      }
      if (ts.isNewExpression(node)) {
        if (!ts.isIdentifier(node.expression) || !PURE_CONSTRUCTORS.has(node.expression.text)) {
          return false;
        }
        return node.arguments?.every((argument) => {
          if (ts.isSpreadElement(argument)) {
            return false;
          }
          return isPureTsExpression(argument, stableLocals);
        }) ?? true;
      }
      if (ts.isCallExpression(node)) {
        return isPureTsCallExpression(node, stableLocals);
      }
      return false;
    };
    const getCalleePath = (node) => {
      if (node.type === "Identifier") {
        return node.name;
      }
      if (node.type === "ChainExpression") {
        return getCalleePath(node.expression);
      }
      if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
        const objectPath = getCalleePath(node.object);
        return objectPath === null ? null : `${objectPath}.${node.property.name}`;
      }
      return null;
    };
    const isPureImportedCallExpression = (callExpression) => {
      if (!tsChecker || !esTreeNodeToTSNodeMap) {
        return false;
      }
      let calleeEsNode = null;
      if (callExpression.callee.type === "Identifier") {
        calleeEsNode = callExpression.callee;
      } else if (callExpression.callee.type === "MemberExpression" && !callExpression.callee.computed && callExpression.callee.property.type === "Identifier") {
        calleeEsNode = callExpression.callee.property;
      }
      if (!calleeEsNode) {
        return false;
      }
      const tsCallee = esTreeNodeToTSNodeMap.get(calleeEsNode);
      if (!tsCallee || !ts.isIdentifier(tsCallee)) {
        return false;
      }
      const symbol = tsChecker.getSymbolAtLocation(tsCallee);
      if (!symbol) {
        return false;
      }
      const target = symbol.flags & ts.SymbolFlags.Alias ? tsChecker.getAliasedSymbol(symbol) : symbol;
      const declaration = target.declarations?.[0];
      if (!declaration) {
        return false;
      }
      if (declaration.getSourceFile().isDeclarationFile) {
        return false;
      }
      const funcNode = getFunctionLikeFromDeclaration(declaration);
      if (!funcNode) {
        return false;
      }
      return isPureTsFunction(funcNode);
    };
    const isPureIdentifierCall = (callExpression) => {
      if (callExpression.callee.type !== "Identifier") {
        return false;
      }
      if (PURE_GLOBAL_FUNCTIONS.has(callExpression.callee.name)) {
        return true;
      }
      if (pureImports.has(callExpression.callee.name)) {
        return true;
      }
      const binding = topLevelBindings.get(callExpression.callee.name);
      if (binding?.kind === "function") {
        return isPureTopLevelFunction(binding.node);
      }
      return isPureImportedCallExpression(callExpression);
    };
    const isUnionType = (type) => Boolean(type.flags & ts.TypeFlags.Union);
    const isObjectLikeType = (type) => {
      if (type.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
        return false;
      }
      if (isUnionType(type)) {
        return type.types.every((member) => {
          if (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) {
            return true;
          }
          return isObjectLikeType(member);
        });
      }
      return Boolean(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection));
    };
    const callReturnsNominalInstance = (node) => {
      if (!tsChecker || !esTreeNodeToTSNodeMap)
        return false;
      const tsNode = esTreeNodeToTSNodeMap.get(node);
      if (!tsNode)
        return false;
      const type = tsChecker.getTypeAtLocation(tsNode);
      return isObjectLikeType(type);
    };
    const isEncapsulatedFreshExpression = (node, stableLocals) => {
      if (!node)
        return false;
      if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression" || node.type === "TSInstantiationExpression") {
        return isEncapsulatedFreshExpression(node.expression, stableLocals);
      }
      if (node.type === "ObjectExpression" || node.type === "ArrayExpression") {
        return isPureRuntimeExpression(node, stableLocals);
      }
      if (node.type === "NewExpression") {
        return node.arguments.every((argument) => {
          if (argument.type === "SpreadElement") {
            return isPureRuntimeExpression(argument.argument, stableLocals);
          }
          return isPureRuntimeExpression(argument, stableLocals);
        });
      }
      if (node.type === "CallExpression") {
        const argsArePure = node.arguments.every((argument) => {
          if (argument.type === "SpreadElement") {
            return isPureRuntimeExpression(argument.argument, stableLocals);
          }
          return isPureRuntimeExpression(argument, stableLocals);
        });
        if (!argsArePure)
          return false;
        if (node.callee.type === "MemberExpression") {
          return isEncapsulatedFreshExpression(node.callee.object, stableLocals);
        }
        if (node.callee.type === "Identifier") {
          return callReturnsNominalInstance(node);
        }
      }
      return false;
    };
    const isPureRuntimeExpression = (node, stableLocals) => {
      if (!node || node.type === "PrivateIdentifier") {
        return false;
      }
      if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression" || node.type === "TSInstantiationExpression") {
        return isPureRuntimeExpression(node.expression, stableLocals);
      }
      switch (node.type) {
        case "Identifier":
          return isStableIdentifier(node.name, stableLocals);
        case "Literal":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
        case "ClassExpression":
          return true;
        case "ThisExpression":
          return stableLocals.has("this");
        case "ChainExpression":
          return isPureRuntimeExpression(node.expression, stableLocals);
        case "TemplateLiteral":
          return node.expressions.every((expression) => isPureRuntimeExpression(expression, stableLocals));
        case "UnaryExpression":
          return isPureRuntimeExpression(node.argument, stableLocals);
        case "BinaryExpression":
        case "LogicalExpression":
          return isPureRuntimeExpression(node.left, stableLocals) && isPureRuntimeExpression(node.right, stableLocals);
        case "ConditionalExpression":
          return isPureRuntimeExpression(node.test, stableLocals) && isPureRuntimeExpression(node.consequent, stableLocals) && isPureRuntimeExpression(node.alternate, stableLocals);
        case "ArrayExpression":
          return node.elements.every((element) => {
            if (!element) {
              return false;
            }
            if (element.type === "SpreadElement") {
              return isPureRuntimeExpression(element.argument, stableLocals);
            }
            return isPureRuntimeExpression(element, stableLocals);
          });
        case "ObjectExpression":
          return node.properties.every((property) => {
            if (property.type !== "Property" || property.computed || property.kind !== "init") {
              return false;
            }
            if (property.key.type !== "Identifier" && property.key.type !== "Literal") {
              return false;
            }
            if (property.method) {
              return true;
            }
            return isPureRuntimeExpression(property.value, stableLocals);
          });
        case "MemberExpression":
          return isPureRuntimeExpression(node.object, stableLocals) && (!node.computed || isPureRuntimeExpression(node.property, stableLocals));
        case "NewExpression": {
          const argsArePure = node.arguments.every((argument) => {
            if (argument.type === "SpreadElement") {
              return isPureRuntimeExpression(argument.argument, stableLocals);
            }
            return isPureRuntimeExpression(argument, stableLocals);
          });
          if (!argsArePure)
            return false;
          if (node.callee.type === "Identifier" && PURE_CONSTRUCTORS.has(node.callee.name)) {
            return true;
          }
          return true;
        }
        case "CallExpression": {
          const argsArePure = node.arguments.every((argument) => {
            if (argument.type === "SpreadElement") {
              return false;
            }
            return isPureRuntimeExpression(argument, stableLocals);
          });
          if (!argsArePure) {
            return false;
          }
          const calleePath = getCalleePath(node.callee);
          if (calleePath !== null && pureImports.has(calleePath)) {
            return true;
          }
          if (node.callee.type === "Identifier") {
            return isPureIdentifierCall(node) || callReturnsNominalInstance(node);
          }
          if (node.callee.type !== "MemberExpression") {
            return false;
          }
          const memberName = getStaticMemberName(node.callee);
          if (memberName && PURE_MEMBER_METHODS.has(memberName)) {
            return isPureRuntimeExpression(node.callee.object, stableLocals);
          }
          if (isEncapsulatedFreshExpression(node.callee.object, stableLocals)) {
            return true;
          }
          if (isPureRuntimeExpression(node.callee.object, stableLocals) && callReturnsNominalInstance(node)) {
            return true;
          }
          return isPureImportedCallExpression(node);
        }
        default:
          return false;
      }
    };
    const isSafeJSXAttributeValue = (value, scopeNode) => {
      if (value === null) {
        return true;
      }
      if (value.type === "Literal") {
        return true;
      }
      if (value.type !== "JSXExpressionContainer") {
        return false;
      }
      if (value.expression.type === "JSXEmptyExpression") {
        return false;
      }
      return isPureRuntimeExpression(value.expression, getStableLocalsForNode(scopeNode));
    };
    const isFunctionProperty = (prop) => {
      const { value } = prop;
      return Boolean(value) && (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression" || prop.method === true);
    };
    const getPropertyKeyName = (prop) => {
      const { key } = prop;
      if (key.type === "Identifier") {
        return key.name;
      }
      if (key.type === "Literal") {
        const { value } = key;
        if (typeof value === "string") {
          return value;
        }
        return String(value);
      }
      return "";
    };
    const getLeadingComments = (prop, prevProp) => {
      const comments = sourceCode.getCommentsBefore(prop);
      if (!prevProp || comments.length === 0) {
        return comments;
      }
      return comments.filter((comment) => comment.loc.start.line !== prevProp.loc.end.line);
    };
    const getTrailingComments = (prop, nextProp) => {
      const after = sourceCode.getCommentsAfter(prop).filter((comment) => comment.loc.start.line === prop.loc.end.line);
      if (!nextProp) {
        return after;
      }
      const beforeNext = sourceCode.getCommentsBefore(nextProp);
      const trailingOfPrev = beforeNext.filter((comment) => comment.loc.start.line === prop.loc.end.line);
      const newComments = trailingOfPrev.filter((comment) => !after.some((existing) => existing.range[0] === comment.range[0]));
      after.push(...newComments);
      return after;
    };
    const getChunkStart = (idx, fixableProps, rangeStart, fullStart) => {
      if (idx === 0) {
        return rangeStart;
      }
      const prevProp = fixableProps[idx - 1];
      const currentProp = fixableProps[idx];
      const prevTrailing = getTrailingComments(prevProp, currentProp);
      const prevEnd = prevTrailing.length > 0 ? prevTrailing[prevTrailing.length - 1].range[1] : prevProp.range[1];
      const allTokens = sourceCode.getTokensBetween(prevProp, currentProp, {
        includeComments: false
      });
      const tokenAfterPrev = allTokens.find((tok) => tok.range[0] >= prevEnd) ?? null;
      if (tokenAfterPrev && tokenAfterPrev.value === "," && tokenAfterPrev.range[1] <= fullStart) {
        return tokenAfterPrev.range[1];
      }
      return prevEnd;
    };
    const compareProps = (left, right) => {
      if (variablesBeforeFunctions) {
        const leftIsFunc = isFunctionProperty(left);
        const rightIsFunc = isFunctionProperty(right);
        if (leftIsFunc !== rightIsFunc) {
          return leftIsFunc ? 1 : SORT_BEFORE;
        }
      }
      let res = compareKeys(getPropertyKeyName(left), getPropertyKeyName(right));
      if (order === "desc") {
        res = -res;
      }
      return res;
    };
    const buildSortedText = (fixableProps, rangeStart) => {
      const chunks = [];
      for (let idx = 0;idx < fixableProps.length; idx++) {
        const prop = fixableProps[idx];
        const prevProp = idx > 0 ? fixableProps[idx - 1] : null;
        const nextProp = idx < fixableProps.length - 1 ? fixableProps[idx + 1] : null;
        const leading = getLeadingComments(prop, prevProp);
        const trailing = getTrailingComments(prop, nextProp);
        const fullStart = leading.length > 0 ? leading[0].range[0] : prop.range[0];
        const fullEnd = trailing.length > 0 ? trailing[trailing.length - 1].range[1] : prop.range[1];
        const chunkStart = getChunkStart(idx, fixableProps, rangeStart, fullStart);
        const text = sourceCode.text.slice(chunkStart, fullEnd);
        chunks.push({ prop, text });
      }
      const sorted = chunks.slice().sort((left, right) => compareProps(left.prop, right.prop));
      const firstPropLine = fixableProps[0].loc.start.line;
      const lastPropLine = fixableProps[fixableProps.length - 1].loc.start.line;
      const isMultiline = firstPropLine !== lastPropLine;
      let separator;
      if (isMultiline) {
        const col = fixableProps[0].loc.start.column;
        const indent = sourceCode.text.slice(fixableProps[0].range[0] - col, fixableProps[0].range[0]);
        separator = `,
${indent}`;
      } else {
        separator = ", ";
      }
      return sorted.map((chunk, idx) => {
        if (idx === 0) {
          const originalFirstChunk = chunks[0];
          const originalLeadingWs = originalFirstChunk.text.match(/^(\s*)/)?.[1] ?? "";
          const stripped2 = chunk.text.replace(/^\s*/, "");
          return originalLeadingWs + stripped2;
        }
        const stripped = chunk.text.replace(/^\s*/, "");
        return separator + stripped;
      }).join("");
    };
    const checkObjectExpression = (node) => {
      if (node.properties.length < minKeys) {
        return;
      }
      const segments = [];
      let currentSegment = [];
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          currentSegment.push(prop);
          continue;
        }
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      let autoFixable = true;
      const keys = node.properties.map((prop) => {
        if (prop.type !== "Property") {
          return { isFunction: false, keyName: null, node: prop };
        }
        if (prop.computed) {
          autoFixable = false;
        }
        let keyName = null;
        if (prop.key.type === "Identifier") {
          keyName = prop.key.name;
        } else if (prop.key.type === "Literal") {
          const { value } = prop.key;
          keyName = typeof value === "string" ? value : String(value);
        } else {
          autoFixable = false;
        }
        return {
          isFunction: isFunctionProperty(prop),
          keyName,
          node: prop
        };
      });
      if (hasDuplicatePropertyNames(node.properties)) {
        autoFixable = false;
      }
      const isSegmentFixable = (segment) => segment.filter((prop) => !isPureRuntimeExpression(prop.value, getStableLocalsForNode(prop))).length <= 1;
      const isSegmentSorted = (segment) => segment.every((prop, idx) => idx === 0 || compareProps(segment[idx - 1], prop) <= 0);
      let fixProvided = false;
      const createReportWithFix = (curr, shouldFix) => {
        context.report({
          fix: shouldFix ? (fixer) => {
            const fixes = segments.filter((segment) => segment.length >= minKeys && isSegmentFixable(segment) && !isSegmentSorted(segment)).map((segment) => {
              const [firstProp] = segment;
              const lastProp = segment[segment.length - 1];
              const firstLeading = getLeadingComments(firstProp, null);
              const [firstLeadingComment] = firstLeading;
              const rangeStart = firstLeadingComment ? firstLeadingComment.range[0] : firstProp.range[0];
              const lastTrailing = getTrailingComments(lastProp, null);
              const rangeEnd = lastTrailing.length > 0 ? lastTrailing[lastTrailing.length - 1].range[1] : lastProp.range[1];
              return fixer.replaceTextRange([rangeStart, rangeEnd], buildSortedText(segment, rangeStart));
            });
            return fixes.length > 0 ? fixes : null;
          } : null,
          messageId: "unsorted",
          node: curr.node.type === "Property" ? curr.node.key : curr.node
        });
        fixProvided = true;
      };
      keys.forEach((curr, idx) => {
        if (idx === 0) {
          return;
        }
        const prev = keys[idx - 1];
        if (!prev || !curr || prev.keyName === null || curr.keyName === null) {
          return;
        }
        const shouldFix = !fixProvided && autoFixable;
        if (variablesBeforeFunctions && prev.isFunction && !curr.isFunction) {
          createReportWithFix(curr, shouldFix);
          return;
        }
        if (variablesBeforeFunctions && prev.isFunction === curr.isFunction && compareKeys(prev.keyName, curr.keyName) > 0) {
          createReportWithFix(curr, shouldFix);
          return;
        }
        if (!variablesBeforeFunctions && compareKeys(prev.keyName, curr.keyName) > 0) {
          createReportWithFix(curr, shouldFix);
        }
      });
    };
    const checkJSXAttributeObject = (attr) => {
      const { value } = attr;
      if (value && value.type === "JSXExpressionContainer" && value.expression && value.expression.type === "ObjectExpression") {
        checkObjectExpression(value.expression);
      }
    };
    const getAttrName = (attr) => {
      if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") {
        return "";
      }
      return attr.name.name;
    };
    const compareAttrNames = (nameLeft, nameRight) => {
      let res = compareKeys(nameLeft, nameRight);
      if (order === "desc") {
        res = -res;
      }
      return res;
    };
    const isOutOfOrder = (names) => names.some((currName, idx) => {
      if (idx === 0 || !currName) {
        return false;
      }
      const prevName = names[idx - 1];
      return prevName !== undefined && compareAttrNames(prevName, currName) > 0;
    });
    const checkJSXOpeningElement = (node) => {
      const attrs = node.attributes;
      if (attrs.length < minKeys) {
        return;
      }
      if (attrs.some((attr) => attr.type !== "JSXAttribute")) {
        return;
      }
      if (attrs.some((attr) => attr.type === "JSXAttribute" && attr.name.type !== "JSXIdentifier")) {
        return;
      }
      const names = attrs.map((attr) => getAttrName(attr));
      if (!isOutOfOrder(names)) {
        return;
      }
      if (hasDuplicateNames(names)) {
        context.report({
          messageId: "unsorted",
          node: attrs[0].type === "JSXAttribute" ? attrs[0].name : attrs[0]
        });
        return;
      }
      const impureAttrCount = attrs.filter((attr) => attr.type === "JSXAttribute" && !isSafeJSXAttributeValue(attr.value, attr)).length;
      if (impureAttrCount > 1) {
        context.report({
          messageId: "unsorted",
          node: attrs[0].type === "JSXAttribute" ? attrs[0].name : attrs[0]
        });
        return;
      }
      const braceConflict = attrs.find((currAttr, idx) => {
        if (idx === 0) {
          return false;
        }
        const prevAttr = attrs[idx - 1];
        if (!prevAttr) {
          return false;
        }
        const between = sourceCode.text.slice(prevAttr.range[1], currAttr.range[0]);
        return between.includes("{");
      });
      if (braceConflict) {
        context.report({
          messageId: "unsorted",
          node: braceConflict.type === "JSXAttribute" ? braceConflict.name : braceConflict
        });
        return;
      }
      const sortedAttrs = attrs.slice().sort((left, right) => compareAttrNames(getAttrName(left), getAttrName(right)));
      const [firstAttr] = attrs;
      const lastAttr = attrs[attrs.length - 1];
      if (!firstAttr || !lastAttr) {
        return;
      }
      const replacement = sortedAttrs.map((attr) => sourceCode.getText(attr)).join(" ");
      context.report({
        fix(fixer) {
          return fixer.replaceTextRange([firstAttr.range[0], lastAttr.range[1]], replacement);
        },
        messageId: "unsorted",
        node: firstAttr.type === "JSXAttribute" ? firstAttr.name : firstAttr
      });
    };
    return {
      JSXAttribute(node) {
        checkJSXAttributeObject(node);
      },
      JSXOpeningElement: checkJSXOpeningElement,
      ObjectExpression: checkObjectExpression
    };
  },
  defaultOptions: [{}],
  meta: {
    docs: {
      description: "enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)"
    },
    fixable: "code",
    messages: {
      unsorted: "Object keys are not sorted."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          caseSensitive: {
            type: "boolean"
          },
          minKeys: {
            minimum: 2,
            type: "integer"
          },
          natural: {
            type: "boolean"
          },
          order: {
            enum: ["asc", "desc"],
            type: "string"
          },
          pureImports: {
            items: { type: "string" },
            type: "array",
            uniqueItems: true
          },
          variablesBeforeFunctions: {
            type: "boolean"
          }
        },
        type: "object"
      }
    ],
    type: "suggestion"
  },
  name: "sort-keys-fixable"
});

// src/rules/no-transition-cssproperties.ts
var getKeyName = (prop) => {
  if (prop.key.type === "Identifier") {
    return prop.key.name;
  }
  if (prop.key.type !== "Literal") {
    return null;
  }
  return typeof prop.key.value === "string" ? prop.key.value : String(prop.key.value);
};
var checkPropForTransition = (context, prop) => {
  if (prop.computed) {
    return;
  }
  const keyName = getKeyName(prop);
  if (keyName === "transition") {
    context.report({
      messageId: "forbiddenTransition",
      node: prop
    });
  }
};
var noTransitionCSSProperties = createRule({
  create(context) {
    const { sourceCode } = context;
    const isCSSPropertiesType = (typeAnnotation) => {
      if (typeAnnotation.type !== "TSTypeReference") {
        return false;
      }
      const { typeName } = typeAnnotation;
      if (typeName.type === "Identifier" && typeName.name === "CSSProperties") {
        return true;
      }
      return typeName.type === "TSQualifiedName" && typeName.right && typeName.right.type === "Identifier" && typeName.right.name === "CSSProperties";
    };
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier" || !node.id.typeAnnotation) {
          return;
        }
        const { typeAnnotation } = node.id.typeAnnotation;
        let isStyleType = isCSSPropertiesType(typeAnnotation);
        if (!isStyleType) {
          const annotationText = sourceCode.getText(node.id.typeAnnotation);
          isStyleType = annotationText.includes("CSSProperties");
        }
        if (!isStyleType) {
          return;
        }
        const { init } = node;
        if (!init || init.type !== "ObjectExpression") {
          return;
        }
        const properties = init.properties.filter((prop) => prop.type === "Property");
        properties.forEach((prop) => {
          checkPropForTransition(context, prop);
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
    },
    messages: {
      forbiddenTransition: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
    },
    schema: [],
    type: "problem"
  },
  name: "no-transition-cssproperties"
});

// src/rules/no-explicit-return-types.ts
var noExplicitReturnTypes = createRule({
  create(context) {
    const hasSingleObjectReturn = (body) => {
      const returnStatements = body.body.filter((stmt) => stmt.type === "ReturnStatement");
      if (returnStatements.length !== 1) {
        return false;
      }
      const [returnStmt] = returnStatements;
      return returnStmt?.argument?.type === "ObjectExpression";
    };
    const getOwnName = (node) => {
      if (node.id)
        return node.id.name;
      const { parent } = node;
      if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
        return parent.id.name;
      }
      return;
    };
    const getDeclaringNode = (node) => {
      if (node.id)
        return node;
      const { parent } = node;
      if (parent.type === "VariableDeclarator")
        return parent.parent;
      return node;
    };
    const collectTypeReferenceNames = (root) => {
      const names = new Set;
      const visit = (value) => {
        if (!value || typeof value !== "object") {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const candidate = value;
        if (typeof candidate.type !== "string") {
          return;
        }
        const astNode = value;
        if (astNode.type === "TSTypeReference" && astNode.typeName.type === "Identifier") {
          names.add(astNode.typeName.name);
        }
        for (const key of Object.keys(astNode)) {
          if (key === "parent") {
            continue;
          }
          visit(astNode[key]);
        }
      };
      visit(root);
      return names;
    };
    const hasReturnOnlyTypeParameter = (node) => {
      const declaredTypeParams = node.typeParameters?.params;
      if (!declaredTypeParams || declaredTypeParams.length === 0) {
        return false;
      }
      const returnTypeNames = collectTypeReferenceNames(node.returnType);
      const parameterTypeNames = new Set;
      for (const parameter of node.params) {
        for (const name of collectTypeReferenceNames(parameter)) {
          parameterTypeNames.add(name);
        }
      }
      return declaredTypeParams.some((typeParam) => returnTypeNames.has(typeParam.name.name) && !parameterTypeNames.has(typeParam.name.name));
    };
    const referencesOwnName = (node) => {
      const ownName = getOwnName(node);
      if (!ownName)
        return false;
      const variable = context.sourceCode.getDeclaredVariables(getDeclaringNode(node)).find((candidate) => candidate.name === ownName);
      if (!variable)
        return false;
      return variable.references.some((reference) => reference.identifier.range[0] >= node.range[0] && reference.identifier.range[1] <= node.range[1]);
    };
    return {
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        const { returnType } = node;
        if (!returnType) {
          return;
        }
        const { typeAnnotation } = returnType;
        if (typeAnnotation && typeAnnotation.type === "TSTypePredicate") {
          return;
        }
        if (node.type === "ArrowFunctionExpression" && node.expression === true && node.body.type === "ObjectExpression") {
          return;
        }
        if (node.body && node.body.type === "BlockStatement" && hasSingleObjectReturn(node.body)) {
          return;
        }
        if (referencesOwnName(node)) {
          return;
        }
        if (hasReturnOnlyTypeParameter(node)) {
          return;
        }
        context.report({
          messageId: "noExplicitReturnType",
          node: returnType
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow explicit return type annotations on functions, except when the annotation is load-bearing: type predicates for type guards, inline object literal returns (e.g., style objects), recursive functions, or generics whose type parameter appears only in the return type."
    },
    messages: {
      noExplicitReturnType: "Explicit return types are disallowed; rely on TypeScript's inference instead."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-explicit-return-type"
});

// src/rules/max-jsx-nesting.ts
var isJSXAncestor = (node) => node.type === "JSXElement" || node.type === "JSXFragment";
var maxJSXNesting = createRule({
  create(context) {
    const [option] = context.options;
    const maxAllowed = typeof option === "number" ? option : 1;
    const getJSXNestingLevel = (node) => {
      let level = 1;
      let current = node.parent;
      while (current) {
        level += isJSXAncestor(current) ? 1 : 0;
        current = current.parent;
      }
      return level;
    };
    return {
      JSXElement(node) {
        const level = getJSXNestingLevel(node);
        if (level > maxAllowed) {
          context.report({
            data: { level, maxAllowed },
            messageId: "tooDeeplyNested",
            node
          });
        }
      }
    };
  },
  defaultOptions: [1],
  meta: {
    docs: {
      description: "Warn when JSX elements are nested too deeply, suggesting refactoring into a separate component."
    },
    messages: {
      tooDeeplyNested: "JSX element is nested too deeply ({{level}} levels, allowed is {{maxAllowed}} levels). Consider refactoring into a separate component."
    },
    schema: [
      {
        minimum: 1,
        type: "number"
      }
    ],
    type: "suggestion"
  },
  name: "max-jsxnesting"
});

// src/rules/seperate-style-files.ts
var seperateStyleFiles = createRule({
  create(context) {
    const { filename } = context;
    if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) {
      return {};
    }
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") {
          return;
        }
        const identifier = node.id;
        const idTypeAnnotation = identifier.typeAnnotation;
        if (!idTypeAnnotation || idTypeAnnotation.type !== "TSTypeAnnotation") {
          return;
        }
        const typeNode = idTypeAnnotation.typeAnnotation;
        if (!typeNode || typeNode.type !== "TSTypeReference") {
          return;
        }
        const typeNameNode = typeNode.typeName;
        let typeName = null;
        if (typeNameNode.type === "Identifier") {
          typeName = typeNameNode.name;
        } else if (typeNameNode.type === "TSQualifiedName") {
          const { right } = typeNameNode;
          typeName = right.name;
        }
        if (typeName === "CSSProperties") {
          context.report({
            data: {
              name: identifier.name,
              typeName
            },
            messageId: "moveToFile",
            node
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Warn when a component file (.jsx or .tsx) contains a style object typed as CSSProperties. " + "Style objects should be moved to their own file under the style folder."
    },
    messages: {
      moveToFile: 'Style object "{{name}}" is typed as {{typeName}}. Move it to its own file under the style folder.'
    },
    schema: [],
    type: "suggestion"
  },
  name: "seperate-style-files"
});

// src/rules/no-unnecessary-key.ts
var isMapCallExpression = (node) => {
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") {
    return false;
  }
  const { property } = node.callee;
  return property.type === "Identifier" && property.name === "map" || property.type === "Literal" && property.value === "map";
};
var noUnnecessaryKey = createRule({
  create(context) {
    const getAncestors = (node) => {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    };
    const isInsideMapCall = (ancestors) => ancestors.some(isMapCallExpression);
    const isReturnedFromFunction = (ancestors) => ancestors.some((ancestor) => ancestor.type === "ReturnStatement");
    const checkJSXOpeningElement = (node) => {
      const keyAttribute = node.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === "key");
      if (!keyAttribute) {
        return;
      }
      const ancestors = getAncestors(node);
      if (isInsideMapCall(ancestors)) {
        return;
      }
      if (isReturnedFromFunction(ancestors)) {
        return;
      }
      context.report({
        messageId: "unnecessaryKey",
        node: keyAttribute
      });
    };
    return {
      JSXOpeningElement: checkJSXOpeningElement
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "enforce that the key prop is only used on components rendered as part of a mapping"
    },
    messages: {
      unnecessaryKey: "The key prop should only be used on elements that are directly rendered as part of an array mapping."
    },
    schema: [],
    type: "problem"
  },
  name: "no-unnecessary-key"
});

// src/rules/sort-exports.ts
var SORT_BEFORE2 = Number.parseInt("-1", 10);
var hasStringTypeProperty = (value) => {
  const maybeType = Reflect.get(value, "type");
  return typeof maybeType === "string";
};
var isNodeLike = (value) => value !== null && value !== undefined && typeof value === "object" && ("type" in value) && hasStringTypeProperty(value);
var shouldSkipNodeEntry = (key, value) => key === "parent" || value === null || value === undefined;
var visitNodeArray = (values, visit) => values.filter(isNodeLike).forEach(visit);
var visitNodeEntryValue = (value, visit) => {
  if (Array.isArray(value)) {
    visitNodeArray(value, visit);
    return;
  }
  if (isNodeLike(value)) {
    visit(value);
  }
};
var visitNodeEntries = (current, visit) => Object.entries(current).filter(([key, value]) => !shouldSkipNodeEntry(key, value)).forEach(([, value]) => {
  visitNodeEntryValue(value, visit);
});
var getVariableDeclaratorName = (declaration) => {
  if (declaration.declarations.length !== 1) {
    return null;
  }
  const [firstDeclarator] = declaration.declarations;
  if (firstDeclarator && firstDeclarator.id.type === "Identifier") {
    return firstDeclarator.id.name;
  }
  return null;
};
var getDeclarationName = (declaration) => {
  if (!declaration) {
    return null;
  }
  if (declaration.type === "VariableDeclaration") {
    return getVariableDeclaratorName(declaration);
  }
  if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id && declaration.id.type === "Identifier") {
    return declaration.id.name;
  }
  return null;
};
var getSpecifierName = (node) => {
  if (node.specifiers.length !== 1) {
    return null;
  }
  const [spec] = node.specifiers;
  if (!spec) {
    return null;
  }
  if (spec.exported.type === "Identifier") {
    return spec.exported.name;
  }
  if (spec.exported.type === "Literal" && typeof spec.exported.value === "string") {
    return spec.exported.value;
  }
  return null;
};
var getExportName = (node) => getDeclarationName(node.declaration) ?? getSpecifierName(node);
var isFixableExport = (exportNode) => {
  const { declaration } = exportNode;
  if (!declaration) {
    return exportNode.specifiers.length === 1;
  }
  if (declaration.type === "VariableDeclaration" && declaration.declarations.length === 1) {
    const [firstDecl] = declaration.declarations;
    return firstDecl !== undefined && firstDecl.id.type === "Identifier";
  }
  return (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id !== null && declaration.id.type === "Identifier";
};
var visitImmediateReferences = (node, onReference) => {
  if (!node) {
    return;
  }
  const visit = (current) => {
    if (!current) {
      return;
    }
    switch (current.type) {
      case "Identifier":
        onReference(current.name);
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return;
      case "CallExpression":
      case "NewExpression": {
        const runAtInit = (invoked) => {
          if (!invoked) {
            return;
          }
          if (invoked.type === "FunctionDeclaration" || invoked.type === "FunctionExpression" || invoked.type === "ArrowFunctionExpression") {
            visit(invoked.body);
            return;
          }
          visit(invoked);
        };
        runAtInit(current.callee);
        current.arguments.forEach(runAtInit);
        return;
      }
      case "MemberExpression":
        visit(current.object);
        if (current.computed) {
          visit(current.property);
        }
        return;
      case "Property":
        if (current.computed) {
          visit(current.key);
        }
        visit(current.value);
        return;
      case "PropertyDefinition":
        if (current.computed) {
          visit(current.key);
        }
        if (current.static) {
          visit(current.value);
        }
        return;
      case "MethodDefinition":
        if (current.computed) {
          visit(current.key);
        }
        return;
      case "StaticBlock":
        for (const statement of current.body) {
          visit(statement);
        }
        return;
    }
    visitNodeEntries(current, visit);
  };
  visit(node);
};
var getDeclarationDecorators = (declaration) => {
  if (declaration && "decorators" in declaration && Array.isArray(declaration.decorators)) {
    return declaration.decorators;
  }
  return [];
};
var getImmediateDependencyNames = (node) => {
  const names = new Set;
  const { declaration } = node;
  const addName = names.add.bind(names);
  const addDeclaratorDependencies = (declarator) => visitImmediateReferences(declarator.init, addName);
  const addClassElementDependencies = (element) => visitImmediateReferences(element, addName);
  if (!declaration) {
    return names;
  }
  if (declaration.type === "VariableDeclaration") {
    declaration.declarations.forEach(addDeclaratorDependencies);
    return names;
  }
  if (declaration.type === "ClassDeclaration") {
    visitImmediateReferences(declaration.superClass, addName);
    getDeclarationDecorators(declaration).forEach((decorator) => visitImmediateReferences(decorator, addName));
    declaration.body.body.forEach(addClassElementDependencies);
  }
  return names;
};
var sortExports = createRule({
  create(context) {
    const { sourceCode } = context;
    const [option] = context.options;
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
    const getNodeStart = (node) => getDeclarationDecorators(node.declaration).reduce((start, decorator) => Math.min(start, decorator.range[0]), node.range[0]);
    const getNodeText = (node) => sourceCode.getText().slice(getNodeStart(node), node.range[1]);
    const generateExportText = (node) => getNodeText(node).trim().replace(/\s*;?\s*$/, ";");
    const compareStrings = (strLeft, strRight) => {
      let left = strLeft;
      let right = strRight;
      if (!caseSensitive) {
        left = left.toLowerCase();
        right = right.toLowerCase();
      }
      const cmp = natural ? left.localeCompare(right, undefined, { numeric: true }) : left.localeCompare(right);
      return order === "asc" ? cmp : -cmp;
    };
    const isFunctionExport = (node) => {
      const { declaration } = node;
      if (!declaration) {
        return false;
      }
      if (declaration.type === "FunctionDeclaration") {
        return true;
      }
      if (declaration.type !== "VariableDeclaration") {
        return false;
      }
      if (declaration.declarations.length !== 1) {
        return false;
      }
      const [firstDeclarator] = declaration.declarations;
      if (!firstDeclarator) {
        return false;
      }
      const { init } = firstDeclarator;
      if (!init) {
        return false;
      }
      return init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression";
    };
    const sortComparator = (left, right) => {
      const kindA = left.node.exportKind ?? "value";
      const kindB = right.node.exportKind ?? "value";
      if (kindA !== kindB) {
        return kindA === "type" ? SORT_BEFORE2 : 1;
      }
      if (variablesBeforeFunctions && left.isFunction !== right.isFunction) {
        return left.isFunction ? 1 : SORT_BEFORE2;
      }
      return compareStrings(left.name, right.name);
    };
    const buildItems = (block) => block.map((node) => {
      const name = getExportName(node);
      if (!name) {
        return null;
      }
      const item = {
        isFunction: isFunctionExport(node),
        name,
        node,
        text: getNodeText(node)
      };
      return item;
    }).filter((item) => item !== null);
    const findFirstUnsorted = (items) => {
      let messageId = "alphabetical";
      const unsorted = items.some((current, idx) => {
        if (idx === 0) {
          return false;
        }
        const prev = items[idx - 1];
        if (!prev) {
          return false;
        }
        if (sortComparator(prev, current) <= 0) {
          return false;
        }
        if (variablesBeforeFunctions && prev.isFunction && !current.isFunction) {
          messageId = "variablesBeforeFunctions";
        }
        return true;
      });
      return unsorted ? messageId : null;
    };
    const hasForwardDependenciesInOrder = (items) => {
      const exportNames = items.map((item) => item.name);
      return items.some((item, idx) => {
        const laterNames = new Set(exportNames.slice(idx + 1));
        if (laterNames.size === 0) {
          return false;
        }
        const dependencies = getImmediateDependencyNames(item.node);
        for (const dependency of dependencies) {
          if (laterNames.has(dependency)) {
            return true;
          }
        }
        return false;
      });
    };
    const wouldCreateForwardDependencies = (items, sortedItems) => {
      const sortedIndices = new Map(sortedItems.map((item, idx) => [item.name, idx]));
      const exportNames = new Set(items.map((item) => item.name));
      return items.some((item) => {
        const itemIndex = sortedIndices.get(item.name);
        if (itemIndex === undefined) {
          return false;
        }
        const dependencies = getImmediateDependencyNames(item.node);
        for (const dependency of dependencies) {
          const dependencyIndex = exportNames.has(dependency) ? sortedIndices.get(dependency) : undefined;
          if (dependencyIndex !== undefined && itemIndex < dependencyIndex)
            return true;
        }
        return false;
      });
    };
    const processExportBlock = (block) => {
      if (block.length < minKeys) {
        return;
      }
      const items = buildItems(block);
      if (items.length < minKeys) {
        return;
      }
      const messageId = findFirstUnsorted(items);
      if (!messageId) {
        return;
      }
      if (hasForwardDependenciesInOrder(items)) {
        return;
      }
      const sortedItems = items.slice().sort(sortComparator);
      if (wouldCreateForwardDependencies(items, sortedItems)) {
        return;
      }
      const expectedOrder = sortedItems.map((item) => item.name).join(", ");
      const [firstNode] = block;
      const lastNode = block[block.length - 1];
      if (!firstNode || !lastNode) {
        return;
      }
      context.report({
        data: {
          expectedOrder
        },
        fix(fixer) {
          const fixableNodes = block.filter(isFixableExport);
          if (fixableNodes.length < minKeys) {
            return null;
          }
          const sortedText = sortedItems.map((item) => generateExportText(item.node)).join(`
`);
          const rangeStart = getNodeStart(firstNode);
          const [, rangeEnd] = lastNode.range;
          const fullText = sourceCode.getText();
          const originalText = fullText.slice(rangeStart, rangeEnd);
          if (originalText === sortedText) {
            return null;
          }
          return fixer.replaceTextRange([rangeStart, rangeEnd], sortedText);
        },
        messageId,
        node: firstNode
      });
    };
    return {
      "Program:exit"(node) {
        const { body } = node;
        const block = [];
        body.forEach((stmt) => {
          if (stmt.type === "ExportNamedDeclaration" && !stmt.source && getExportName(stmt) !== null) {
            block.push(stmt);
            return;
          }
          if (block.length > 0) {
            processExportBlock(block);
            block.length = 0;
          }
        });
        if (block.length > 0) {
          processExportBlock(block);
        }
      }
    };
  },
  defaultOptions: [{}],
  meta: {
    docs: {
      description: "Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports"
    },
    fixable: "code",
    messages: {
      alphabetical: "Export declarations are not sorted alphabetically. Expected order: {{expectedOrder}}.",
      variablesBeforeFunctions: "Non-function exports should come before function exports."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          caseSensitive: {
            type: "boolean"
          },
          minKeys: {
            minimum: 2,
            type: "integer"
          },
          natural: {
            type: "boolean"
          },
          order: {
            enum: ["asc", "desc"],
            type: "string"
          },
          variablesBeforeFunctions: {
            type: "boolean"
          }
        },
        type: "object"
      }
    ],
    type: "suggestion"
  },
  name: "sort-exports"
});

// src/rules/localize-react-props.ts
import { AST_NODE_TYPES as AST_NODE_TYPES3 } from "@typescript-eslint/utils";
var localizeReactProps = createRule({
  create(context) {
    const candidateVariables = [];
    const getSingleSetElement = (set) => {
      for (const value of set) {
        return value;
      }
      return null;
    };
    const getRightmostJSXIdentifier = (name) => {
      let current = name;
      while (current.type === AST_NODE_TYPES3.JSXMemberExpression) {
        current = current.property;
      }
      if (current.type === AST_NODE_TYPES3.JSXIdentifier) {
        return current;
      }
      return null;
    };
    const getLeftmostJSXIdentifier = (name) => {
      let current = name;
      while (current.type === AST_NODE_TYPES3.JSXMemberExpression) {
        current = current.object;
      }
      if (current.type === AST_NODE_TYPES3.JSXIdentifier) {
        return current;
      }
      return null;
    };
    const getJSXElementName = (jsxElement) => {
      if (!jsxElement || !jsxElement.openingElement || !jsxElement.openingElement.name) {
        return "";
      }
      const nameNode = jsxElement.openingElement.name;
      if (nameNode.type === AST_NODE_TYPES3.JSXIdentifier) {
        return nameNode.name;
      }
      const rightmost = getRightmostJSXIdentifier(nameNode);
      if (rightmost) {
        return rightmost.name;
      }
      return "";
    };
    const isUseStateCall = (node) => node !== null && node.type === AST_NODE_TYPES3.CallExpression && node.callee !== null && (node.callee.type === AST_NODE_TYPES3.Identifier && node.callee.name === "useState" || node.callee.type === AST_NODE_TYPES3.MemberExpression && node.callee.property !== null && node.callee.property.type === AST_NODE_TYPES3.Identifier && node.callee.property.name === "useState");
    const isHookCall = (node) => node !== null && node.type === AST_NODE_TYPES3.CallExpression && node.callee !== null && node.callee.type === AST_NODE_TYPES3.Identifier && /^use[A-Z]/.test(node.callee.name) && node.callee.name !== "useState";
    const getJSXAncestor = (node) => {
      let current = node.parent;
      while (current) {
        if (current.type === AST_NODE_TYPES3.JSXElement) {
          return current;
        }
        current = current.parent;
      }
      return null;
    };
    const getTagNameFromOpening = (openingElement) => {
      const nameNode = openingElement.name;
      if (nameNode.type === AST_NODE_TYPES3.JSXIdentifier) {
        return nameNode.name;
      }
      const rightmost = getRightmostJSXIdentifier(nameNode);
      return rightmost ? rightmost.name : null;
    };
    const isProviderOrContext = (tagName) => tagName.endsWith("Provider") || tagName.endsWith("Context");
    const isValueAttributeOnProvider = (node) => node.type === AST_NODE_TYPES3.JSXAttribute && node.name && node.name.type === AST_NODE_TYPES3.JSXIdentifier && node.name.name === "value" && node.parent && node.parent.type === AST_NODE_TYPES3.JSXOpeningElement && (() => {
      const tagName = getTagNameFromOpening(node.parent);
      return tagName !== null && isProviderOrContext(tagName);
    })();
    const isContextProviderValueProp = (node) => {
      let current = node.parent;
      while (current) {
        if (isValueAttributeOnProvider(current)) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };
    const isCustomJSXElement = (jsxElement) => {
      if (!jsxElement || !jsxElement.openingElement || !jsxElement.openingElement.name) {
        return false;
      }
      const nameNode = jsxElement.openingElement.name;
      if (nameNode.type === AST_NODE_TYPES3.JSXIdentifier) {
        return /^[A-Z]/.test(nameNode.name);
      }
      const leftmost = getLeftmostJSXIdentifier(nameNode);
      return leftmost !== null && /^[A-Z]/.test(leftmost.name);
    };
    const getComponentFunction = (node) => {
      let current = node;
      while (current) {
        if (current.type === AST_NODE_TYPES3.FunctionDeclaration || current.type === AST_NODE_TYPES3.FunctionExpression || current.type === AST_NODE_TYPES3.ArrowFunctionExpression) {
          return current;
        }
        current = current.parent;
      }
      return null;
    };
    const findVariableForIdentifier = (identifier) => {
      let scope = context.sourceCode.getScope(identifier);
      while (scope) {
        const found = scope.variables.find((variable) => variable.defs.some((def) => def.name === identifier));
        if (found) {
          return found;
        }
        scope = scope.upper ?? null;
      }
      return null;
    };
    const classifyReference = (reference, declarationId, jsxUsageSet) => {
      const { identifier } = reference;
      if (identifier === declarationId || isContextProviderValueProp(identifier)) {
        return false;
      }
      const jsxAncestor = getJSXAncestor(identifier);
      if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
        jsxUsageSet.add(jsxAncestor);
        return false;
      }
      return true;
    };
    const analyzeVariableUsage = (declarationId) => {
      const variable = findVariableForIdentifier(declarationId);
      if (!variable) {
        return {
          hasOutsideUsage: false,
          jsxUsageSet: new Set
        };
      }
      const jsxUsageSet = new Set;
      const hasOutsideUsage = variable.references.some((ref) => classifyReference(ref, declarationId, jsxUsageSet));
      return {
        hasOutsideUsage,
        jsxUsageSet
      };
    };
    const componentHookVars = new WeakMap;
    const getHookSet = (componentFunction) => {
      let hookSet = componentHookVars.get(componentFunction);
      if (!hookSet) {
        hookSet = new Set;
        componentHookVars.set(componentFunction, hookSet);
      }
      return hookSet;
    };
    const isRangeContained = (refRange, nodeRange) => refRange[0] >= nodeRange[0] && refRange[1] <= nodeRange[1];
    const variableHasReferenceInRange = (variable, nodeRange) => variable.references.some((reference) => reference.identifier.range !== undefined && isRangeContained(reference.identifier.range, nodeRange));
    const hasHookDependency = (node, hookSet) => {
      if (!node.range) {
        return false;
      }
      const nodeRange = node.range;
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        const hookVars = scope.variables.filter((variable) => hookSet.has(variable.name));
        if (hookVars.some((variable) => variableHasReferenceInRange(variable, nodeRange))) {
          return true;
        }
        scope = scope.upper ?? null;
      }
      return false;
    };
    const processUseStateDeclarator = (node) => {
      if (!node.init || !isUseStateCall(node.init) || node.id.type !== AST_NODE_TYPES3.ArrayPattern || node.id.elements.length < 2) {
        return false;
      }
      const [stateElem, setterElem] = node.id.elements;
      if (!stateElem || stateElem.type !== AST_NODE_TYPES3.Identifier || !setterElem || setterElem.type !== AST_NODE_TYPES3.Identifier) {
        return false;
      }
      const stateVarName = stateElem.name;
      const setterVarName = setterElem.name;
      const stateUsage = analyzeVariableUsage(stateElem);
      const setterUsage = analyzeVariableUsage(setterElem);
      const stateExclusivelySingleJSX = !stateUsage.hasOutsideUsage && stateUsage.jsxUsageSet.size === 1;
      const setterExclusivelySingleJSX = !setterUsage.hasOutsideUsage && setterUsage.jsxUsageSet.size === 1;
      if (!stateExclusivelySingleJSX || !setterExclusivelySingleJSX) {
        return true;
      }
      const stateTarget = getSingleSetElement(stateUsage.jsxUsageSet);
      const setterTarget = getSingleSetElement(setterUsage.jsxUsageSet);
      if (stateTarget && stateTarget === setterTarget) {
        context.report({
          data: { setterVarName, stateVarName },
          messageId: "stateAndSetterToChild",
          node
        });
      }
      return true;
    };
    const processGeneralVariable = (node, componentFunction) => {
      if (!node.id || node.id.type !== AST_NODE_TYPES3.Identifier) {
        return;
      }
      const varName = node.id.name;
      if (node.init) {
        const hookSet = getHookSet(componentFunction);
        if (hasHookDependency(node.init, hookSet)) {
          return;
        }
      }
      const usage = analyzeVariableUsage(node.id);
      if (!usage.hasOutsideUsage && usage.jsxUsageSet.size === 1) {
        const target = getSingleSetElement(usage.jsxUsageSet);
        const componentName = getJSXElementName(target);
        candidateVariables.push({
          componentName,
          node,
          varName
        });
      }
    };
    return {
      "Program:exit"() {
        const groups = new Map;
        candidateVariables.forEach((candidate) => {
          const key = candidate.componentName;
          const existing = groups.get(key);
          if (existing) {
            existing.push(candidate);
          } else {
            groups.set(key, [candidate]);
          }
        });
        groups.forEach((candidates) => {
          if (candidates.length !== 1) {
            return;
          }
          const [candidate] = candidates;
          if (!candidate) {
            return;
          }
          context.report({
            data: { varName: candidate.varName },
            messageId: "variableToChild",
            node: candidate.node
          });
        });
      },
      VariableDeclarator(node) {
        const componentFunction = getComponentFunction(node);
        if (!componentFunction || !componentFunction.body)
          return;
        if (node.init && node.id && node.id.type === AST_NODE_TYPES3.Identifier && node.init.type === AST_NODE_TYPES3.CallExpression && isHookCall(node.init)) {
          const hookSet = getHookSet(componentFunction);
          hookSet.add(node.id.name);
        }
        const wasUseState = processUseStateDeclarator(node);
        if (!wasUseState) {
          processGeneralVariable(node, componentFunction);
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate \u2013 if two or more are passed to the same component type, they're assumed to be settings that belong on the parent."
    },
    messages: {
      stateAndSetterToChild: "State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
      variableToChild: "Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component."
    },
    schema: [],
    type: "suggestion"
  },
  name: "localize-react-props"
});

// src/rules/no-or-none-component.ts
var noOrNoneComponent = createRule({
  create(context) {
    return {
      ConditionalExpression(node) {
        const { alternate } = node;
        const isNullAlternate = alternate && alternate.type === "Literal" && alternate.value === null;
        const isUndefinedAlternate = alternate && alternate.type === "Identifier" && alternate.name === "undefined";
        if (!isNullAlternate && !isUndefinedAlternate) {
          return;
        }
        const { parent } = node;
        if (!parent || parent.type !== "JSXExpressionContainer") {
          return;
        }
        const containerParent = parent.parent;
        if (containerParent && containerParent.type !== "JSXAttribute") {
          context.report({
            messageId: "useLogicalAnd",
            node
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Prefer using logical && operator over ternary with null/undefined for conditional JSX rendering."
    },
    messages: {
      useLogicalAnd: "Prefer using the logical '&&' operator instead of a ternary with null/undefined for conditional rendering."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-or-none-component"
});

// src/rules/no-button-navigation.ts
var noButtonNavigation = createRule({
  create(context) {
    const handlerStack = [];
    const getCurrentHandler = () => {
      const state = handlerStack[handlerStack.length - 1];
      if (!state) {
        return null;
      }
      return state;
    };
    const isOnClickButtonHandler = (node) => {
      const { parent } = node;
      if (!parent || parent.type !== "JSXExpressionContainer") {
        return null;
      }
      const attributeCandidate = parent.parent;
      if (!attributeCandidate || attributeCandidate.type !== "JSXAttribute") {
        return null;
      }
      const attr = attributeCandidate;
      if (!attr.name || attr.name.type !== "JSXIdentifier" || attr.name.name !== "onClick") {
        return null;
      }
      const openingElementCandidate = attr.parent;
      if (!openingElementCandidate || openingElementCandidate.type !== "JSXOpeningElement") {
        return null;
      }
      const tagNameNode = openingElementCandidate.name;
      if (tagNameNode.type !== "JSXIdentifier" || tagNameNode.name !== "button") {
        return null;
      }
      return attr;
    };
    const isWindowLocationMember = (member) => {
      const { object } = member;
      if (object.type !== "MemberExpression") {
        return false;
      }
      const outerObject = object.object;
      const outerProperty = object.property;
      return outerObject.type === "Identifier" && outerObject.name === "window" && outerProperty.type === "Identifier" && outerProperty.name === "location";
    };
    const isWindowHistoryMember = (member) => {
      const { object } = member;
      if (object.type !== "MemberExpression") {
        return false;
      }
      const outerObject = object.object;
      const outerProperty = object.property;
      return outerObject.type === "Identifier" && outerObject.name === "window" && outerProperty.type === "Identifier" && outerProperty.name === "history";
    };
    const reportHandlerExit = (state) => {
      const { reason, sawReplaceCall, sawAllowedLocationRead } = state;
      if (reason) {
        context.report({
          data: { reason },
          messageId: "noButtonNavigation",
          node: state.attribute
        });
        return;
      }
      if (sawReplaceCall && !sawAllowedLocationRead) {
        context.report({
          data: {
            reason: "history.replaceState/pushState without reading window.location"
          },
          messageId: "noButtonNavigation",
          node: state.attribute
        });
      }
    };
    return {
      ArrowFunctionExpression(node) {
        const attr = isOnClickButtonHandler(node);
        if (!attr) {
          return;
        }
        handlerStack.push({
          attribute: attr,
          reason: null,
          sawAllowedLocationRead: false,
          sawReplaceCall: false
        });
      },
      "ArrowFunctionExpression:exit"(node) {
        const attr = isOnClickButtonHandler(node);
        if (!attr) {
          return;
        }
        const state = handlerStack.pop();
        if (!state) {
          return;
        }
        reportHandlerExit(state);
      },
      AssignmentExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        if (node.left.type !== "MemberExpression") {
          return;
        }
        const { left } = node;
        if (left.object.type === "Identifier" && left.object.name === "window" && left.property.type === "Identifier" && left.property.name === "location" && !state.reason) {
          state.reason = "assignment to window.location";
          return;
        }
        if (isWindowLocationMember(left) && !state.reason) {
          state.reason = "assignment to window.location sub-property";
        }
      },
      CallExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        const { callee } = node;
        if (callee.type !== "MemberExpression") {
          return;
        }
        if (isWindowLocationMember(callee) && callee.property.type === "Identifier" && callee.property.name === "replace" && !state.reason) {
          state.reason = "window.location.replace";
          return;
        }
        if (isWindowHistoryMember(callee) && callee.property.type === "Identifier" && (callee.property.name === "pushState" || callee.property.name === "replaceState")) {
          state.sawReplaceCall = true;
        }
      },
      FunctionExpression(node) {
        const attr = isOnClickButtonHandler(node);
        if (!attr) {
          return;
        }
        handlerStack.push({
          attribute: attr,
          reason: null,
          sawAllowedLocationRead: false,
          sawReplaceCall: false
        });
      },
      "FunctionExpression:exit"(node) {
        const attr = isOnClickButtonHandler(node);
        if (!attr) {
          return;
        }
        const state = handlerStack.pop();
        if (!state) {
          return;
        }
        reportHandlerExit(state);
      },
      MemberExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        if (node.object.type === "Identifier" && node.object.name === "window" && node.property.type === "Identifier" && node.property.name === "open" && !state.reason) {
          state.reason = "window.open";
        }
        if (isWindowLocationMember(node) && node.property.type === "Identifier" && (node.property.name === "search" || node.property.name === "pathname" || node.property.name === "hash")) {
          state.sawAllowedLocationRead = true;
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + \u2026)."
    },
    messages: {
      noButtonNavigation: "Use an anchor tag for navigation instead of a button whose onClick handler changes the path. Detected: {{reason}}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-button-navigation"
});

// src/rules/no-multi-style-objects.ts
var getPropertyName = (prop) => {
  const { key } = prop;
  if (key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "Literal" && typeof key.value === "string") {
    return key.value;
  }
  return null;
};
var noMultiStyleObjects = createRule({
  create(context) {
    const checkObjectExpression = (node) => {
      if (!node.properties.length) {
        return;
      }
      const cssStyleProperties = node.properties.filter((prop) => {
        if (prop.type !== "Property") {
          return false;
        }
        const name = getPropertyName(prop);
        return name !== null && name.endsWith("Style");
      });
      if (cssStyleProperties.length > 1) {
        context.report({
          messageId: "noMultiStyleObjects",
          node
        });
      }
    };
    return {
      ExportDefaultDeclaration(node) {
        const { declaration } = node;
        if (declaration && declaration.type === "ObjectExpression") {
          checkObjectExpression(declaration);
        }
      },
      ReturnStatement(node) {
        const { argument } = node;
        if (argument && argument.type === "ObjectExpression") {
          checkObjectExpression(argument);
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow grouping CSS style objects in a single export; export each style separately."
    },
    messages: {
      noMultiStyleObjects: "Do not group CSS style objects in a single export; export each style separately."
    },
    schema: [],
    type: "problem"
  },
  name: "no-multi-style-objects"
});

// src/rules/no-useless-catch.ts
var unwrapExpression = (expression) => {
  switch (expression.type) {
    case "ChainExpression":
      return unwrapExpression(expression.expression);
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return unwrapExpression(expression.expression);
    default:
      return expression;
  }
};
var hasSideEffect = (expression) => {
  const unwrapped = unwrapExpression(expression);
  switch (unwrapped.type) {
    case "AssignmentExpression":
    case "AwaitExpression":
    case "CallExpression":
    case "ImportExpression":
    case "NewExpression":
    case "UpdateExpression":
    case "YieldExpression":
      return true;
    case "UnaryExpression":
      return unwrapped.operator === "delete";
    case "ConditionalExpression":
      return hasSideEffect(unwrapped.consequent) || hasSideEffect(unwrapped.alternate);
    case "LogicalExpression":
      return hasSideEffect(unwrapped.left) || hasSideEffect(unwrapped.right);
    case "SequenceExpression":
      return unwrapped.expressions.some(hasSideEffect);
    default:
      return false;
  }
};
var statementDoesWork = (statement) => {
  if (statement.type === "EmptyStatement") {
    return false;
  }
  if (statement.type === "ExpressionStatement") {
    return hasSideEffect(statement.expression);
  }
  return true;
};
var noUselessCatch = createRule({
  create(context) {
    return {
      CatchClause(node) {
        if (node.body.body.some(statementDoesWork)) {
          return;
        }
        context.report({
          messageId: "uselessCatch",
          node: node.body
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow catch blocks that contain only comments or no-op statements. A catch block should handle, propagate, or record the error."
    },
    messages: {
      uselessCatch: "This catch block does not do any work. Handle, log, return, or rethrow the error instead of leaving a comment or no-op."
    },
    schema: [],
    type: "problem"
  },
  name: "no-useless-catch"
});

// src/rules/no-useless-function.ts
var noUselessFunction = createRule({
  create(context) {
    const isStaticObjectLiteral = (object) => object.properties.every((property) => {
      if (property.type !== "Property" || property.computed) {
        return false;
      }
      const { value } = property;
      return value.type === "Literal" || value.type === "TemplateLiteral" && value.expressions.length === 0;
    });
    const isWithinCallArgument = (node) => {
      let child = node;
      let current = node.parent;
      while (current) {
        if (current.type === "CallExpression" && current.arguments.some((argument) => argument === child)) {
          return true;
        }
        child = current;
        current = current.parent;
      }
      return false;
    };
    return {
      ArrowFunctionExpression(node) {
        if (node.params.length !== 0 || !node.body || node.body.type !== "ObjectExpression") {
          return;
        }
        if (!isStaticObjectLiteral(node.body)) {
          return;
        }
        if (isWithinCallArgument(node)) {
          return;
        }
        context.report({
          messageId: "uselessFunction",
          node
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring)."
    },
    messages: {
      uselessFunction: "This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-useless-function"
});

// src/rules/min-var-length.ts
var extractIdentifiersFromPattern = (pattern, identifiers = []) => {
  if (!pattern)
    return identifiers;
  switch (pattern.type) {
    case "Identifier":
      identifiers.push(pattern.name);
      break;
    case "ObjectPattern":
      pattern.properties.forEach((prop) => {
        if (prop.type === "Property") {
          extractIdentifiersFromPattern(prop.value, identifiers);
        } else if (prop.type === "RestElement") {
          extractIdentifiersFromPattern(prop.argument, identifiers);
        }
      });
      break;
    case "ArrayPattern":
      pattern.elements.filter((element) => element !== null).forEach((element) => {
        extractIdentifiersFromPattern(element, identifiers);
      });
      break;
    case "AssignmentPattern":
      extractIdentifiersFromPattern(pattern.left, identifiers);
      break;
    default:
      break;
  }
  return identifiers;
};
var getDeclaratorNames = (declarations) => declarations.filter((decl) => decl.id.type === "Identifier").map((decl) => decl.id.name);
var collectParamNames = (params) => {
  const names = [];
  params.forEach((param) => {
    extractIdentifiersFromPattern(param, names);
  });
  return names;
};
var minVarLength = createRule({
  create(context) {
    const { sourceCode } = context;
    const [options] = context.options;
    const configuredMinLength = options && typeof options.minLength === "number" ? options.minLength : 1;
    const configuredAllowedVars = options && Array.isArray(options.allowedVars) ? options.allowedVars : [];
    const minLength = configuredMinLength;
    const allowedVars = configuredAllowedVars;
    const getAncestors = (node) => {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    };
    const getScope = (node) => {
      const { scopeManager } = sourceCode;
      if (!scopeManager) {
        return null;
      }
      const acquired = scopeManager.acquire(node);
      if (acquired) {
        return acquired;
      }
      return scopeManager.globalScope ?? null;
    };
    const getVariablesInNearestBlock = (node) => {
      let current = node.parent;
      while (current && current.type !== "BlockStatement") {
        current = current.parent;
      }
      if (!current || current.type !== "BlockStatement" || !Array.isArray(current.body)) {
        return [];
      }
      const varDeclarations = current.body.filter((stmt) => stmt.type === "VariableDeclaration");
      return varDeclarations.flatMap((stmt) => getDeclaratorNames(stmt.declarations));
    };
    const isLongerMatchInScope = (shortName, varName) => varName.length >= minLength && varName.length > shortName.length && varName.startsWith(shortName);
    const checkScopeVariables = (shortName, node) => {
      const startingScope = getScope(node);
      let outer = startingScope && startingScope.upper ? startingScope.upper : null;
      while (outer) {
        if (outer.variables.some((variable) => isLongerMatchInScope(shortName, variable.name))) {
          return true;
        }
        outer = outer.upper;
      }
      return false;
    };
    const checkBlockVariables = (shortName, node) => {
      const blockVars = getVariablesInNearestBlock(node);
      return blockVars.some((varName) => isLongerMatchInScope(shortName, varName));
    };
    const checkAncestorDeclarators = (shortName, node) => {
      const ancestors = getAncestors(node);
      return ancestors.some((anc) => anc.type === "VariableDeclarator" && anc.id && anc.id.type === "Identifier" && isLongerMatchInScope(shortName, anc.id.name));
    };
    const checkFunctionAncestor = (shortName, anc) => {
      const names = collectParamNames(anc.params);
      return names.some((paramName) => isLongerMatchInScope(shortName, paramName));
    };
    const checkCatchAncestor = (shortName, anc) => {
      if (!anc.param) {
        return false;
      }
      const names = extractIdentifiersFromPattern(anc.param, []);
      return names.some((paramName) => isLongerMatchInScope(shortName, paramName));
    };
    const checkAncestorParams = (shortName, node) => {
      const ancestors = getAncestors(node);
      return ancestors.some((anc) => {
        if (anc.type === "FunctionDeclaration" || anc.type === "FunctionExpression" || anc.type === "ArrowFunctionExpression") {
          return checkFunctionAncestor(shortName, anc);
        }
        if (anc.type === "CatchClause") {
          return checkCatchAncestor(shortName, anc);
        }
        return false;
      });
    };
    const hasOuterCorrespondingIdentifier = (shortName, node) => checkScopeVariables(shortName, node) || checkBlockVariables(shortName, node) || checkAncestorDeclarators(shortName, node) || checkAncestorParams(shortName, node);
    const checkIdentifier = (node) => {
      const { name } = node;
      if (name.length >= minLength) {
        return;
      }
      if (allowedVars.includes(name)) {
        return;
      }
      if (!hasOuterCorrespondingIdentifier(name, node)) {
        context.report({
          data: { minLength, name },
          messageId: "variableNameTooShort",
          node
        });
      }
    };
    const checkPattern = (pattern) => {
      if (!pattern)
        return;
      switch (pattern.type) {
        case "Identifier":
          checkIdentifier(pattern);
          break;
        case "ObjectPattern":
          pattern.properties.forEach((prop) => {
            if (prop.type === "Property") {
              checkPattern(prop.value);
            } else if (prop.type === "RestElement") {
              checkPattern(prop.argument);
            }
          });
          break;
        case "ArrayPattern":
          pattern.elements.filter((element) => element !== null).forEach((element) => {
            checkPattern(element);
          });
          break;
        case "AssignmentPattern":
          checkPattern(pattern.left);
          break;
        default:
          break;
      }
    };
    return {
      CatchClause(node) {
        if (node.param) {
          checkPattern(node.param);
        }
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        node.params.forEach((param) => {
          checkPattern(param);
        });
      },
      VariableDeclarator(node) {
        if (node.id) {
          checkPattern(node.id);
        }
      }
    };
  },
  defaultOptions: [{}],
  meta: {
    docs: {
      description: "Disallow variable names shorter than the configured minimum length unless an outer variable with a longer name starting with the same characters exists. You can exempt specific variable names using the allowedVars option."
    },
    messages: {
      variableNameTooShort: "Variable '{{name}}' is too short. Minimum allowed length is {{minLength}} characters unless an outer variable with a longer name starting with '{{name}}' exists."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allowedVars: {
            default: [],
            items: {
              minLength: 1,
              type: "string"
            },
            type: "array"
          },
          minLength: {
            default: 1,
            type: "number"
          }
        },
        type: "object"
      }
    ],
    type: "problem"
  },
  name: "min-var-length"
});

// src/rules/max-depth-extended.ts
var maxDepthExtended = createRule({
  create(context) {
    const [option] = context.options;
    const maxDepth = typeof option === "number" ? option : 1;
    const functionStack = [];
    const getAncestors = (node) => {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    };
    const isEarlyExitBlock = (node) => {
      if (node.body.length !== 1) {
        return false;
      }
      const [first] = node.body;
      if (!first) {
        return false;
      }
      return first.type === "ReturnStatement" || first.type === "ThrowStatement";
    };
    const isFunctionBody = (node) => {
      const ancestors = getAncestors(node);
      const [parent] = ancestors;
      return parent && (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && node === parent.body;
    };
    const incrementCurrentDepth = () => {
      if (functionStack.length === 0) {
        return null;
      }
      const index = functionStack.length - 1;
      const currentDepth = functionStack[index];
      if (typeof currentDepth !== "number") {
        return null;
      }
      const nextDepth = currentDepth + 1;
      functionStack[index] = nextDepth;
      return nextDepth;
    };
    const decrementCurrentDepth = () => {
      if (functionStack.length === 0) {
        return;
      }
      const index = functionStack.length - 1;
      const currentDepth = functionStack[index];
      if (typeof currentDepth !== "number") {
        return;
      }
      functionStack[index] = currentDepth - 1;
    };
    const checkDepth = (node, depth) => {
      if (depth > maxDepth) {
        context.report({
          data: { depth, maxDepth },
          messageId: "tooDeep",
          node
        });
      }
    };
    return {
      ArrowFunctionExpression() {
        functionStack.push(0);
      },
      "ArrowFunctionExpression:exit"() {
        functionStack.pop();
      },
      BlockStatement(node) {
        if (isFunctionBody(node)) {
          return;
        }
        if (isEarlyExitBlock(node)) {
          return;
        }
        const depth = incrementCurrentDepth();
        if (depth !== null) {
          checkDepth(node, depth);
        }
      },
      "BlockStatement:exit"(node) {
        if (isFunctionBody(node)) {
          return;
        }
        if (isEarlyExitBlock(node)) {
          return;
        }
        decrementCurrentDepth();
      },
      FunctionDeclaration() {
        functionStack.push(0);
      },
      "FunctionDeclaration:exit"() {
        functionStack.pop();
      },
      FunctionExpression() {
        functionStack.push(0);
      },
      "FunctionExpression:exit"() {
        functionStack.pop();
      }
    };
  },
  defaultOptions: [1],
  meta: {
    docs: {
      description: "disallow too many nested blocks except when the block only contains an early exit (return or throw)"
    },
    messages: {
      tooDeep: "Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early exit."
    },
    schema: [
      {
        type: "number"
      }
    ],
    type: "suggestion"
  },
  name: "max-depth-extended"
});

// src/rules/spring-naming-convention.ts
var SPRINGS_SUFFIX = "Springs";
var checkUseSpring = (context, firstElem, secondElem) => {
  const firstName = firstElem.name;
  const secondName = secondElem.name;
  if (!firstName.endsWith(SPRINGS_SUFFIX)) {
    context.report({
      messageId: "firstMustEndWithSprings",
      node: firstElem
    });
    return;
  }
  const base = firstName.slice(0, -SPRINGS_SUFFIX.length);
  if (!base) {
    context.report({
      messageId: "firstMustHaveBase",
      node: firstElem
    });
    return;
  }
  const expectedSecond = `${base}Api`;
  if (secondName !== expectedSecond) {
    context.report({
      data: { expected: expectedSecond },
      messageId: "secondMustMatch",
      node: secondElem
    });
  }
};
var checkUseSprings = (context, firstElem, secondElem) => {
  const firstName = firstElem.name;
  const secondName = secondElem.name;
  if (!firstName.endsWith(SPRINGS_SUFFIX)) {
    context.report({
      messageId: "firstMustEndWithSprings",
      node: firstElem
    });
    return;
  }
  const basePlural = firstName.slice(0, -SPRINGS_SUFFIX.length);
  if (!basePlural) {
    context.report({
      messageId: "firstMustHaveBase",
      node: firstElem
    });
    return;
  }
  if (!basePlural.endsWith("s")) {
    context.report({
      messageId: "pluralRequired",
      node: firstElem
    });
    return;
  }
  const expectedSecond = `${basePlural}Api`;
  if (secondName !== expectedSecond) {
    context.report({
      data: { expected: expectedSecond },
      messageId: "secondMustMatch",
      node: secondElem
    });
  }
};
var springNamingConvention = createRule({
  create(context) {
    return {
      VariableDeclarator(node) {
        const { init } = node;
        if (!init || init.type !== "CallExpression" || init.callee.type !== "Identifier") {
          return;
        }
        const hookName = init.callee.name;
        if (hookName !== "useSpring" && hookName !== "useSprings") {
          return;
        }
        if (node.id.type !== "ArrayPattern") {
          return;
        }
        const { elements } = node.id;
        if (elements.length < 2) {
          return;
        }
        const [firstElem, secondElem] = elements;
        if (!firstElem || firstElem.type !== "Identifier" || !secondElem || secondElem.type !== "Identifier") {
          return;
        }
        if (hookName === "useSpring") {
          checkUseSpring(context, firstElem, secondElem);
          return;
        }
        if (hookName === "useSprings") {
          checkUseSprings(context, firstElem, secondElem);
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Enforce correct naming for useSpring and useSprings hook destructuring"
    },
    messages: {
      firstMustEndWithSprings: "The first variable must end with 'Springs'.",
      firstMustHaveBase: "The first variable must have a non-empty name before 'Springs'.",
      pluralRequired: "The first variable for useSprings should be plural (ending with 's') before 'Springs'.",
      secondMustMatch: "The second variable must be named '{{expected}}'."
    },
    schema: [],
    type: "problem"
  },
  name: "spring-naming-convention"
});

// src/rules/inline-style-limit.ts
var DEFAULT_MAX_KEYS = 3;
var inlineStyleLimit = createRule({
  create(context) {
    const [option] = context.options;
    const maxKeys = typeof option === "number" ? option : option && option.maxKeys || DEFAULT_MAX_KEYS;
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") {
          return;
        }
        if (!node.value || node.value.type !== "JSXExpressionContainer" || !node.value.expression || node.value.expression.type !== "ObjectExpression") {
          return;
        }
        const styleObject = node.value.expression;
        const keyCount = styleObject.properties.filter((prop) => prop.type === "Property").length;
        if (keyCount > maxKeys) {
          context.report({
            data: { max: maxKeys },
            messageId: "extractStyle",
            node
          });
        }
      }
    };
  },
  defaultOptions: [DEFAULT_MAX_KEYS],
  meta: {
    docs: {
      description: "Disallow inline style objects with too many keys and encourage extracting them"
    },
    messages: {
      extractStyle: "Inline style objects should be extracted into a separate object or file when containing more than {{max}} keys."
    },
    schema: [
      {
        anyOf: [
          {
            type: "number"
          },
          {
            additionalProperties: false,
            properties: {
              maxKeys: {
                description: "Maximum number of keys allowed in an inline style object before it must be extracted.",
                type: "number"
              }
            },
            type: "object"
          }
        ]
      }
    ],
    type: "suggestion"
  },
  name: "inline-style-limit"
});

// src/rules/no-inline-object-types.ts
var DEFAULT_MIN_PROPERTIES = 2;
var toPascalCase = (name) => {
  const parts = name.replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0)
    return name;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
};
var collectInlineObjectTypes = (node, found) => {
  if (node.type === "TSTypeLiteral") {
    found.push(node);
    return;
  }
  if (node.type === "TSArrayType") {
    collectInlineObjectTypes(node.elementType, found);
    return;
  }
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    node.types.forEach((member) => collectInlineObjectTypes(member, found));
    return;
  }
  if (node.type === "TSTypeReference" && node.typeArguments) {
    node.typeArguments.params.forEach((arg) => collectInlineObjectTypes(arg, found));
  }
};
var unwrapParamTarget = (node) => {
  if (node.type === "TSParameterProperty") {
    return unwrapParamTarget(node.parameter);
  }
  if (node.type === "AssignmentPattern") {
    return unwrapParamTarget(node.left);
  }
  return node;
};
var SCOPE_BOUNDARY_TYPES = new Set([
  "ArrowFunctionExpression",
  "ClassDeclaration",
  "ClassExpression",
  "FunctionDeclaration",
  "FunctionExpression"
]);
var deriveNameFromAncestors = (node) => {
  let current = node.parent;
  while (current) {
    if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
      return toPascalCase(current.id.name);
    }
    if (current.type === "PropertyDefinition" && current.key.type === "Identifier") {
      return toPascalCase(current.key.name);
    }
    if (SCOPE_BOUNDARY_TYPES.has(current.type))
      return "T";
    current = current.parent;
  }
  return "T";
};
var noInlineObjectTypes = createRule({
  create(context) {
    const [options] = context.options;
    const minProperties = options?.minProperties ?? DEFAULT_MIN_PROPERTIES;
    const reportAnnotation = (typeNode, suggestedName) => {
      const literals = [];
      collectInlineObjectTypes(typeNode, literals);
      for (const literal of literals) {
        if (literal.members.length < minProperties)
          continue;
        const hasIndexSignature = literal.members.some((member) => member.type === "TSIndexSignature");
        if (hasIndexSignature)
          continue;
        context.report({
          data: { suggestedName },
          messageId: "inlineObjectType",
          node: literal
        });
      }
    };
    const handleFunctionParams = (params) => {
      for (const param of params) {
        const target = unwrapParamTarget(param);
        if (!("typeAnnotation" in target))
          continue;
        const annotation = target.typeAnnotation;
        if (!annotation || annotation.type !== "TSTypeAnnotation")
          continue;
        const name = target.type === "Identifier" ? toPascalCase(target.name) : "Params";
        reportAnnotation(annotation.typeAnnotation, name);
      }
    };
    return {
      "CallExpression, NewExpression"(node) {
        if (!node.typeArguments)
          return;
        const name = deriveNameFromAncestors(node);
        for (const typeArg of node.typeArguments.params) {
          reportAnnotation(typeArg, name);
        }
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        handleFunctionParams(node.params);
      },
      PropertyDefinition(node) {
        if (!node.typeAnnotation || node.typeAnnotation.type !== "TSTypeAnnotation")
          return;
        const name = node.key.type === "Identifier" ? toPascalCase(node.key.name) : "Field";
        reportAnnotation(node.typeAnnotation.typeAnnotation, name);
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier")
          return;
        const annotation = node.id.typeAnnotation;
        if (!annotation || annotation.type !== "TSTypeAnnotation")
          return;
        reportAnnotation(annotation.typeAnnotation, toPascalCase(node.id.name));
      }
    };
  },
  defaultOptions: [{ minProperties: DEFAULT_MIN_PROPERTIES }],
  meta: {
    docs: {
      description: "Disallow inline object type literals on annotations (variables, class fields, function params, generic type arguments); prefer extracting them to a named type alias."
    },
    messages: {
      inlineObjectType: "Inline object type should be extracted to a named type alias (e.g., `type {{suggestedName}} = { ... }`)."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          minProperties: {
            minimum: 1,
            type: "number"
          }
        },
        type: "object"
      }
    ],
    type: "suggestion"
  },
  name: "no-inline-object-types"
});

// src/rules/no-nondeterministic-render.ts
import { AST_NODE_TYPES as AST_NODE_TYPES4 } from "@typescript-eslint/utils";
var BANNED_TEMPLATE_PATTERN = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bcrypto\.randomUUID\s*\(|\bperformance\.now\s*\(/;
var isIdentifier2 = (node, name) => node?.type === AST_NODE_TYPES4.Identifier && node.name === name;
var isStaticMemberCall = (node, objectName, propertyName) => node.callee.type === AST_NODE_TYPES4.MemberExpression && !node.callee.computed && isIdentifier2(node.callee.object, objectName) && isIdentifier2(node.callee.property, propertyName);
var getPropertyName2 = (node) => {
  const { key } = node;
  if (key.type === AST_NODE_TYPES4.Identifier)
    return key.name;
  if (key.type === AST_NODE_TYPES4.Literal && typeof key.value === "string") {
    return key.value;
  }
  return null;
};
var isComponentDecorator = (decorator) => {
  const { expression } = decorator;
  return expression.type === AST_NODE_TYPES4.CallExpression && isIdentifier2(expression.callee, "Component");
};
var isAngularComponentClass = (node) => node.type === AST_NODE_TYPES4.ClassDeclaration && (node.decorators ?? []).some(isComponentDecorator);
var getTemplateText = (node) => {
  if (node.type === AST_NODE_TYPES4.Literal && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === AST_NODE_TYPES4.TemplateLiteral) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
  }
  return null;
};
var getEnclosingAngularComponentClass = (node) => {
  let current = node.parent;
  while (current) {
    if (isAngularComponentClass(current))
      return current;
    current = current.parent;
  }
  return null;
};
var getEnclosingPropertyDefinition = (node) => {
  let current = node.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES4.PropertyDefinition) {
      return current;
    }
    if (current.type === AST_NODE_TYPES4.MethodDefinition || current.type === AST_NODE_TYPES4.FunctionDeclaration || current.type === AST_NODE_TYPES4.FunctionExpression || current.type === AST_NODE_TYPES4.ArrowFunctionExpression) {
      return null;
    }
    current = current.parent;
  }
  return null;
};
var isInAngularFieldInitializer = (node) => {
  const propertyDefinition = getEnclosingPropertyDefinition(node);
  if (!propertyDefinition || propertyDefinition.value === null)
    return false;
  return getEnclosingAngularComponentClass(propertyDefinition) !== null;
};
var isBannedCall = (node) => isStaticMemberCall(node, "Math", "random") || isStaticMemberCall(node, "Date", "now") || isStaticMemberCall(node, "crypto", "randomUUID") || isStaticMemberCall(node, "performance", "now");
var noNondeterministicRender = createRule({
  create(context) {
    const reportField = (node) => {
      if (!isInAngularFieldInitializer(node))
        return;
      context.report({
        messageId: "nondeterministicField",
        node
      });
    };
    return {
      CallExpression(node) {
        if (isBannedCall(node))
          reportField(node);
      },
      "ClassDeclaration > Decorator CallExpression > ObjectExpression > Property"(node) {
        if (getPropertyName2(node) !== "template")
          return;
        const templateText = getTemplateText(node.value);
        if (templateText === null || !BANNED_TEMPLATE_PATTERN.test(templateText)) {
          return;
        }
        context.report({
          messageId: "nondeterministicTemplate",
          node: node.value
        });
      },
      NewExpression(node) {
        if (isIdentifier2(node.callee, "Date") && node.arguments.length === 0) {
          reportField(node);
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow nondeterministic values in Angular render paths that can cause SSR hydration mismatches."
    },
    messages: {
      nondeterministicField: "Do not use nondeterministic values in Angular component field initializers. Inject AbsoluteJS deterministic tokens instead.",
      nondeterministicTemplate: "Do not use nondeterministic values in Angular templates. Compute a deterministic value before render instead."
    },
    schema: [],
    type: "problem"
  },
  name: "no-nondeterministic-render"
});

// src/rules/no-redundant-type-annotation.ts
import * as ts2 from "typescript";
var ALLOWED_INIT_TYPES = new Set([
  "CallExpression",
  "Identifier",
  "MemberExpression",
  "NewExpression",
  "TSAsExpression"
]);
var noRedundantTypeAnnotation = createRule({
  create(context) {
    const { sourceCode } = context;
    const parserServices = sourceCode.parserServices ?? null;
    const tsProgram = parserServices && "program" in parserServices ? parserServices.program : null;
    const tsChecker = tsProgram ? tsProgram.getTypeChecker() : null;
    const esTreeNodeToTSNodeMap = parserServices && "esTreeNodeToTSNodeMap" in parserServices ? parserServices.esTreeNodeToTSNodeMap : null;
    if (!tsChecker || !esTreeNodeToTSNodeMap) {
      return {};
    }
    const stringify = (type) => tsChecker.typeToString(type, undefined, ts2.TypeFormatFlags.NoTruncation | ts2.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    const referencesTypeParam = (typeNode, name) => {
      let found = false;
      const visit = (node) => {
        if (found)
          return;
        if (ts2.isTypeReferenceNode(node) && ts2.isIdentifier(node.typeName) && node.typeName.text === name) {
          found = true;
          return;
        }
        ts2.forEachChild(node, visit);
      };
      visit(typeNode);
      return found;
    };
    const leansOnContextualInference = (initNode) => {
      const callLike = ts2.isCallExpression(initNode) || ts2.isNewExpression(initNode) ? initNode : null;
      if (!callLike)
        return false;
      if (callLike.typeArguments && callLike.typeArguments.length > 0) {
        return false;
      }
      const resolved = tsChecker.getResolvedSignature(callLike);
      const declaration = resolved?.declaration;
      if (declaration && !ts2.isJSDocSignature(declaration)) {
        const typeParams = declaration.typeParameters;
        if (!typeParams || typeParams.length === 0)
          return false;
        return typeParams.some((typeParam) => !declaration.parameters.some((parameter) => parameter.type !== undefined && referencesTypeParam(parameter.type, typeParam.name.text)));
      }
      const calleeType = tsChecker.getTypeAtLocation(callLike.expression);
      const signatures = ts2.isNewExpression(callLike) ? calleeType.getConstructSignatures() : calleeType.getCallSignatures();
      return signatures.some((signature) => (signature.getTypeParameters()?.length ?? 0) > 0);
    };
    return {
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier")
          return;
        if (!node.id.typeAnnotation)
          return;
        if (!node.init)
          return;
        if (!ALLOWED_INIT_TYPES.has(node.init.type))
          return;
        const annotationASTNode = node.id.typeAnnotation.typeAnnotation;
        const annotationTSNode = esTreeNodeToTSNodeMap.get(annotationASTNode);
        const initTSNode = esTreeNodeToTSNodeMap.get(node.init);
        if (!annotationTSNode || !initTSNode)
          return;
        if (!ts2.isTypeNode(annotationTSNode))
          return;
        if (leansOnContextualInference(initTSNode))
          return;
        const annotationType = tsChecker.getTypeFromTypeNode(annotationTSNode);
        const initType = tsChecker.getTypeAtLocation(initTSNode);
        const aliasSymbol = ts2.isTypeReferenceNode(annotationTSNode) ? tsChecker.getSymbolAtLocation(annotationTSNode.typeName) : undefined;
        if (aliasSymbol && aliasSymbol.flags & ts2.SymbolFlags.TypeAlias && initType.aliasSymbol !== aliasSymbol) {
          return;
        }
        const bothAny = (annotationType.flags & ts2.TypeFlags.Any) !== 0 && (initType.flags & ts2.TypeFlags.Any) !== 0;
        if (bothAny)
          return;
        if (annotationType.aliasSymbol !== initType.aliasSymbol)
          return;
        if (stringify(annotationType) !== stringify(initType))
          return;
        const annotationNode = node.id.typeAnnotation;
        context.report({
          fix(fixer) {
            return fixer.removeRange(annotationNode.range);
          },
          messageId: "redundantTypeAnnotation",
          node: annotationNode
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow type annotations on variable declarations whose initializer already has the same inferred type."
    },
    fixable: "code",
    messages: {
      redundantTypeAnnotation: "Type annotation is redundant \u2014 the initializer already has this type. Remove the annotation and let TypeScript infer it."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-redundant-type-annotation"
});

// src/rules/no-import-meta-path.ts
var FILESYSTEM_PATH_PROPERTIES = new Set(["dir", "dirname", "filename"]);
var isImportMeta = (node) => node.type === "MetaProperty" && node.meta.name === "import" && node.property.name === "meta";
var importMetaProperty = (node) => {
  if (!isImportMeta(node.object))
    return null;
  if (node.computed || node.property.type !== "Identifier")
    return null;
  return node.property.name;
};
var calleeName = (callee) => {
  if (callee.type === "Identifier")
    return callee.name;
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
    return callee.property.name;
  }
  return null;
};
var noImportMetaPath = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (calleeName(node.callee) !== "fileURLToPath")
          return;
        const urlArgument = node.arguments.find((argument) => argument.type === "MemberExpression" && importMetaProperty(argument) === "url");
        if (urlArgument) {
          context.report({
            messageId: "importMetaUrl",
            node: urlArgument
          });
        }
      },
      MemberExpression(node) {
        const property = importMetaProperty(node);
        if (property && FILESYSTEM_PATH_PROPERTIES.has(property)) {
          context.report({
            data: { property },
            messageId: "importMetaPath",
            node
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow deriving filesystem paths from a module's own location (`import.meta.dir`/`dirname`/`filename`, `fileURLToPath(import.meta.url)`). They move when the server is bundled, so paths break in `absolute start`. Anchor to `projectRoot` from @absolutejs/absolute or `process.cwd()`. This targets application server code; a library locating its OWN shipped assets is a legitimate exception (projectRoot is the consuming app's root, not the package's location) \u2014 turn the rule off for those files via an override."
    },
    messages: {
      importMetaPath: "`import.meta.{{property}}` resolves this module's own location, which is your src/ tree in `absolute dev` but the bundled dist/ in `absolute start` \u2014 module-relative paths silently break in production. Anchor runtime/data paths to `projectRoot` from @absolutejs/absolute (or `process.cwd()`).",
      importMetaUrl: "`fileURLToPath(import.meta.url)` derives a filesystem path from this module's own location, which moves when the server is bundled (src/ in `absolute dev`, dist/ in `absolute start`) \u2014 so the path silently breaks in production. Anchor runtime/data paths to `projectRoot` from @absolutejs/absolute (or `process.cwd()`)."
    },
    schema: [],
    type: "problem"
  },
  name: "no-import-meta-path"
});

// src/rules/no-trivial-alias.ts
var isBareTypeReference = (node) => {
  if (node.type === "TSTypeReference") {
    return !node.typeArguments || node.typeArguments.params.length === 0;
  }
  switch (node.type) {
    case "TSStringKeyword":
    case "TSNumberKeyword":
    case "TSBooleanKeyword":
    case "TSNullKeyword":
    case "TSUndefinedKeyword":
    case "TSVoidKeyword":
    case "TSAnyKeyword":
    case "TSUnknownKeyword":
    case "TSNeverKeyword":
    case "TSBigIntKeyword":
    case "TSSymbolKeyword":
    case "TSObjectKeyword":
      return true;
    default:
      return false;
  }
};
var isBareIdentifierInit = (init) => init.type === "Identifier";
var isConstSource = (context, id) => {
  const scope = context.sourceCode.getScope(id);
  const variable = scope.references.find((ref) => ref.identifier === id)?.resolved;
  if (!variable || variable.defs.length === 0)
    return false;
  return variable.defs.every((def) => {
    if (def.type !== "Variable")
      return false;
    const { parent } = def;
    if (!parent || parent.type !== "VariableDeclaration")
      return false;
    return parent.kind === "const";
  });
};
var noTrivialAlias = createRule({
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (!isBareTypeReference(node.typeAnnotation))
          return;
        context.report({
          data: { name: node.id.name },
          messageId: "trivialTypeAlias",
          node
        });
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier")
          return;
        if (node.id.typeAnnotation)
          return;
        if (!node.init)
          return;
        if (!isBareIdentifierInit(node.init))
          return;
        if (!isConstSource(context, node.init))
          return;
        context.report({
          data: { name: node.id.name },
          messageId: "trivialConstAlias",
          node
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow identity aliases that rename a type or value without transforming it \u2014 `type X = Y` and `const x = y`. Pick one name and use it everywhere."
    },
    messages: {
      trivialConstAlias: "`{{name}}` is a trivial rename of another binding. Use the original at the consumer instead \u2014 duplicate aliases drift when one side is updated and the other isn't.",
      trivialTypeAlias: "`{{name}}` is a pure rename of another type. Use the original type at the consumer instead \u2014 duplicate aliases drift when one side is updated and the other isn't."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-trivial-alias"
});

// src/rules/no-unnecessary-div.ts
import { AST_NODE_TYPES as AST_NODE_TYPES5 } from "@typescript-eslint/utils";
var noUnnecessaryDiv = createRule({
  create(context) {
    const isDivElement = (node) => {
      const nameNode = node.openingElement.name;
      return nameNode.type === AST_NODE_TYPES5.JSXIdentifier && nameNode.name === "div";
    };
    const isMeaningfulChild = (child) => {
      if (child.type === AST_NODE_TYPES5.JSXText) {
        return child.value.trim() !== "";
      }
      return true;
    };
    const getMeaningfulChildren = (node) => node.children.filter(isMeaningfulChild);
    return {
      JSXElement(node) {
        if (!isDivElement(node)) {
          return;
        }
        const meaningfulChildren = getMeaningfulChildren(node);
        if (meaningfulChildren.length !== 1) {
          return;
        }
        const [onlyChild] = meaningfulChildren;
        if (!onlyChild) {
          return;
        }
        if (onlyChild.type === AST_NODE_TYPES5.JSXElement) {
          context.report({
            messageId: "unnecessaryDivWrapper",
            node
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed."
    },
    messages: {
      unnecessaryDivWrapper: "Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose."
    },
    schema: [],
    type: "suggestion"
  },
  name: "no-unnecessary-div"
});

// src/rules/prefer-inline-exports.ts
var isLocalDeclaration = (node) => node.type === "VariableDeclaration" || node.type === "FunctionDeclaration" || node.type === "ClassDeclaration" || node.type === "TSTypeAliasDeclaration" || node.type === "TSInterfaceDeclaration" || node.type === "TSEnumDeclaration";
var declarationName = (decl) => {
  if (decl.type === "VariableDeclaration") {
    if (decl.declarations.length !== 1)
      return null;
    const [first] = decl.declarations;
    if (!first || first.id.type !== "Identifier")
      return null;
    return first.id.name;
  }
  if (!decl.id || decl.id.type !== "Identifier")
    return null;
  return decl.id.name;
};
var findOwnDeclaration = (program, name) => {
  for (const stmt of program.body) {
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration && isLocalDeclaration(stmt.declaration) && declarationName(stmt.declaration) === name) {
      return { alreadyExported: true, decl: stmt.declaration };
    }
    if (stmt.type === "ExportDefaultDeclaration" && isLocalDeclaration(stmt.declaration) && declarationName(stmt.declaration) === name) {
      return { alreadyExported: true, decl: stmt.declaration };
    }
    if (isLocalDeclaration(stmt) && declarationName(stmt) === name) {
      return { alreadyExported: false, decl: stmt };
    }
  }
  return null;
};
var preferInlineExports = createRule({
  create(context) {
    const { sourceCode } = context;
    const program = sourceCode.ast;
    return {
      ExportNamedDeclaration(node) {
        if (node.source)
          return;
        if (node.declaration)
          return;
        if (node.specifiers.length === 0)
          return;
        if (node.exportKind === "type")
          return;
        const fixable = [];
        for (const spec of node.specifiers) {
          if (spec.type !== "ExportSpecifier")
            continue;
          if (spec.local.type !== "Identifier")
            continue;
          if (spec.exported.type !== "Identifier")
            continue;
          if (spec.local.name !== spec.exported.name)
            continue;
          if (spec.exportKind === "type")
            continue;
          const found = findOwnDeclaration(program, spec.local.name);
          if (!found)
            continue;
          if (found.alreadyExported)
            continue;
          fixable.push({ decl: found.decl, spec });
        }
        if (fixable.length === 0)
          return;
        const allSpecsAreFixable = fixable.length === node.specifiers.length;
        const names = fixable.map(({ spec }) => spec.local.type === "Identifier" ? spec.local.name : "").filter((name) => name.length > 0);
        context.report({
          data: { names: names.join(", ") },
          fix(fixer) {
            const fixes = [];
            for (const { decl } of fixable) {
              const [declStart] = decl.range;
              fixes.push(fixer.insertTextBeforeRange([declStart, declStart], "export "));
            }
            if (allSpecsAreFixable) {
              fixes.push(fixer.remove(node));
            } else {
              const survivors = node.specifiers.filter((spec) => !fixable.some((entry) => entry.spec === spec));
              const replacement = `export { ${survivors.map((spec) => sourceCode.getText(spec)).join(", ")} };`;
              fixes.push(fixer.replaceText(node, replacement));
            }
            return fixes;
          },
          messageId: "preferInline",
          node
        });
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Prefer inlining `export` at a declaration site over a trailing `export { name }` statement when the name is a local declaration."
    },
    fixable: "code",
    messages: {
      preferInline: "Inline `export` at the declaration of `{{names}}` instead of re-exporting at the bottom of the file."
    },
    schema: [],
    type: "suggestion"
  },
  name: "prefer-inline-exports"
});

// src/utils/buttonAccessibility.ts
var BUTTON_OPEN_PATTERN = /<button\b/giu;
var BUTTON_CLOSE = "</button";
var BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//gu;
var HTML_COMMENT_SOURCE_PATTERN = /<!--[\s\S]*?-->/gu;
var MATERIAL_ICON_OPEN_PATTERN = /<(?:i|span)\b(?=[^>]*(?:class|className)\s*=\s*(?:"[^"]*\bmaterial-icons(?:-[\w-]+)?\b[^"]*"|'[^']*\bmaterial-icons(?:-[\w-]+)?\b[^']*'|\{["'`][^}"'`]*\bmaterial-icons(?:-[\w-]+)?\b[^}"'`]*["'`]\}))[^>]*>/giu;
var MATERIAL_ICON_ELEMENT_PATTERN = /<(i|span)\b(?=[^>]*(?:class|className)\s*=\s*(?:"[^"]*\bmaterial-icons(?:-[\w-]+)?\b[^"]*"|'[^']*\bmaterial-icons(?:-[\w-]+)?\b[^']*'|\{["'`][^}"'`]*\bmaterial-icons(?:-[\w-]+)?\b[^}"'`]*["'`]\}))[^>]*>[\s\S]*?<\/\1\s*>/giu;
var ACCESSIBLE_NAME_PATTERN = /(?:^|\s)(?::|v-bind:|\[attr\.)?aria-(?:label|labelledby)(?:\])?\s*=/iu;
var ARIA_HIDDEN_TRUE_PATTERN = /(?:^|\s)(?::|v-bind:|\[attr\.)?aria-hidden(?:\])?\s*=\s*(?:"true"|'true'|\{true\}|"\{\{true\}\}")/iu;
var TAG_PATTERN = /<[^>]*>/gu;
var COMMENT_PATTERN = /<!--(?:[\s\S]*?)-->/gu;
var HTML_ENTITY_PATTERN = /&(?:nbsp|#160|#xA0);/giu;
var READABLE_PATTERN = /[\p{L}\p{N}]/u;
var TEMPLATE_PROCESSOR_PREFIX = `/* absolute-template-source
`;
var STYLE_BLOCK_PATTERN = /<style\b[^>]*>[\s\S]*?<\/style\s*>/giu;
var TITLE_PATTERN = /(?:^|\s)((?::|v-bind:)?title)\s*=\s*("[^"]*"|'[^']*')/iu;
var NOT_FOUND = -1;
var preserveLines = (value) => value.replace(/[^\n]/gu, " ");
var maskIgnoredSource = (source) => (source.startsWith(TEMPLATE_PROCESSOR_PREFIX) ? source : source.replace(BLOCK_COMMENT_PATTERN, preserveLines)).replace(STYLE_BLOCK_PATTERN, preserveLines).replace(HTML_COMMENT_SOURCE_PATTERN, preserveLines);
var accessibleNameInsertion = (opening) => {
  const match = TITLE_PATTERN.exec(opening);
  if (!match)
    return null;
  const [, titleName, titleValue] = match;
  if (!titleName || !titleValue)
    return null;
  const attributeName = titleName.startsWith(":") || titleName.startsWith("v-bind:") ? ":aria-label" : "aria-label";
  return ` ${attributeName}=${titleValue}`;
};
var tagEnd = (source, start) => {
  let quote = null;
  let braceDepth = 0;
  for (let index = start;index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\")
        quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{")
      braceDepth += 1;
    else if (character === "}" && braceDepth > 0)
      braceDepth -= 1;
    else if (character === ">" && braceDepth === 0)
      return index;
  }
  return NOT_FOUND;
};
var hasReadableContent = (inner) => {
  const withoutIcons = inner.replace(MATERIAL_ICON_ELEMENT_PATTERN, "");
  const text = withoutIcons.replace(COMMENT_PATTERN, "").replace(TAG_PATTERN, "").replace(HTML_ENTITY_PATTERN, "").trim();
  return READABLE_PATTERN.test(text);
};
var exposedIcons = (inner, innerOffset) => {
  const icons = [];
  for (const match of inner.matchAll(MATERIAL_ICON_OPEN_PATTERN)) {
    const [opening] = match;
    if (ARIA_HIDDEN_TRUE_PATTERN.test(opening))
      continue;
    const start = innerOffset + (match.index ?? 0);
    icons.push({ openingEnd: start + opening.length - 1, start });
  }
  return icons;
};
var scanButtonAccessibility = (source) => {
  const findings = [];
  for (const match of maskIgnoredSource(source).matchAll(BUTTON_OPEN_PATTERN)) {
    const buttonStart = match.index ?? 0;
    const openingEnd = tagEnd(source, buttonStart);
    if (openingEnd < 0)
      continue;
    const opening = source.slice(buttonStart, openingEnd + 1);
    const selfClosing = /\/\s*>$/u.test(opening);
    const closeStart = selfClosing ? openingEnd + 1 : source.toLowerCase().indexOf(BUTTON_CLOSE, openingEnd + 1);
    const innerEnd = closeStart < 0 ? openingEnd + 1 : closeStart;
    const inner = source.slice(openingEnd + 1, innerEnd);
    findings.push({
      accessibleNameInsertion: accessibleNameInsertion(opening),
      buttonOpeningEnd: openingEnd,
      buttonStart,
      exposedIcons: exposedIcons(inner, openingEnd + 1),
      missingAccessibleName: !ACCESSIBLE_NAME_PATTERN.test(opening) && !hasReadableContent(inner)
    });
  }
  return findings;
};

// src/rules/button-icon-is-hidden.ts
var reportExposedIcon = (context, icon) => {
  const start = context.sourceCode.getLocFromIndex(icon.start);
  context.report({
    fix: (fixer) => fixer.insertTextBeforeRange([icon.openingEnd, icon.openingEnd], ' aria-hidden="true"'),
    loc: { end: start, start },
    messageId: "iconNotHidden"
  });
};
var buttonIconIsHidden = createRule({
  create(context) {
    return {
      Program() {
        scanButtonAccessibility(context.sourceCode.text).flatMap((finding) => finding.exposedIcons).forEach((icon) => reportExposedIcon(context, icon));
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Require Material Icons inside buttons to be hidden from assistive technology across frontend template syntaxes."
    },
    fixable: "code",
    messages: {
      iconNotHidden: 'Material Icons inside buttons are decorative. Add aria-hidden="true" so assistive technology reads the button action instead of the icon ligature.'
    },
    schema: [],
    type: "problem"
  },
  name: "button-icon-is-hidden"
});

// src/rules/icon-button-has-accessible-name.ts
var iconButtonHasAccessibleName = createRule({
  create(context) {
    return {
      Program() {
        for (const finding of scanButtonAccessibility(context.sourceCode.text)) {
          if (!finding.missingAccessibleName)
            continue;
          const start = context.sourceCode.getLocFromIndex(finding.buttonStart);
          const insertion = finding.accessibleNameInsertion;
          context.report({
            fix: insertion ? (fixer) => fixer.insertTextBeforeRange([
              finding.buttonOpeningEnd,
              finding.buttonOpeningEnd
            ], insertion) : undefined,
            loc: { end: start, start },
            messageId: "missingAccessibleName"
          });
        }
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Require icon-only buttons to have an aria-label or aria-labelledby across frontend template syntaxes."
    },
    fixable: "code",
    messages: {
      missingAccessibleName: "Icon-only buttons need a descriptive aria-label or aria-labelledby. A title or raw icon name is not an accessible action name."
    },
    schema: [],
    type: "problem"
  },
  name: "icon-button-has-accessible-name"
});

// src/processors/template-source.ts
var WRAPPER_LINES = 1;
var BLOCK_COMMENT_PATTERN2 = /\/\*[\s\S]*?\*\//gu;
var preserveLines2 = (value) => value.replace(/[^\n]/gu, " ");
var templateSourceProcessor = {
  meta: { name: "template-source", version: "1" },
  postprocess(messageLists) {
    return (messageLists[0] ?? []).map((message) => ({
      ...message,
      endLine: message.endLine === undefined ? undefined : Math.max(1, message.endLine - WRAPPER_LINES),
      line: Math.max(1, (message.line ?? 1) - WRAPPER_LINES)
    }));
  },
  preprocess(text, filename) {
    return [
      {
        filename: `${filename}.js`,
        text: `/* absolute-template-source
${text.replace(BLOCK_COMMENT_PATTERN2, preserveLines2)}
*/`
      }
    ];
  },
  supportsAutofix: false
};

// src/index.ts
var src_default = {
  processors: {
    "template-source": templateSourceProcessor
  },
  rules: {
    "angular-one-feature-per-file": angularOneFeaturePerFile,
    "button-icon-is-hidden": buttonIconIsHidden,
    "explicit-object-types": explicitObjectTypes,
    "heading-order": headingOrder,
    "icon-button-has-accessible-name": iconButtonHasAccessibleName,
    "inline-style-limit": inlineStyleLimit,
    "localize-react-props": localizeReactProps,
    "max-depth-extended": maxDepthExtended,
    "max-jsxnesting": maxJSXNesting,
    "min-var-length": minVarLength,
    "no-button-navigation": noButtonNavigation,
    "no-explicit-return-type": noExplicitReturnTypes,
    "no-import-meta-path": noImportMetaPath,
    "no-inline-object-types": noInlineObjectTypes,
    "no-multi-style-objects": noMultiStyleObjects,
    "no-nested-jsx-return": noNestedJSXReturn,
    "no-nondeterministic-render": noNondeterministicRender,
    "no-or-none-component": noOrNoneComponent,
    "no-redundant-type-annotation": noRedundantTypeAnnotation,
    "no-transition-cssproperties": noTransitionCSSProperties,
    "no-trivial-alias": noTrivialAlias,
    "no-unnecessary-div": noUnnecessaryDiv,
    "no-unnecessary-key": noUnnecessaryKey,
    "no-useless-catch": noUselessCatch,
    "no-useless-function": noUselessFunction,
    "prefer-inline-exports": preferInlineExports,
    "seperate-style-files": seperateStyleFiles,
    "sort-exports": sortExports,
    "sort-keys-fixable": sortKeysFixable,
    "spring-naming-convention": springNamingConvention
  }
};
export {
  src_default as default
};
