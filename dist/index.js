// @bun
// src/rules/no-nested-jsx-return.ts
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
var noNestedJSXReturn = {
  create(context) {
    const isJSX = (node) => node !== null && node !== undefined && (node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment);
    const getLeftmostJSXIdentifier = (name) => {
      let current = name;
      while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
        current = current.object;
      }
      if (current.type === AST_NODE_TYPES.JSXIdentifier) {
        return current;
      }
      return null;
    };
    const isJSXComponentElement = (node) => {
      if (!node || node.type !== AST_NODE_TYPES.JSXElement) {
        return false;
      }
      const opening = node.openingElement;
      const nameNode = opening.name;
      if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
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
        if (child.type === AST_NODE_TYPES.JSXText) {
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
        if (child2.type === AST_NODE_TYPES.JSXText) {
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
      if (child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXFragment) {
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
  }
};

// src/rules/explicit-object-types.ts
var explicitObjectTypes = {
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
  }
};

// src/rules/sort-keys-fixable.ts
var SORT_BEFORE = -1;
var sortKeysFixable = {
  create(context) {
    const { sourceCode } = context;
    const [option] = context.options;
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
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
      const sorted = chunks.slice().sort((left, right) => {
        if (variablesBeforeFunctions) {
          const leftIsFunc = isFunctionProperty(left.prop);
          const rightIsFunc = isFunctionProperty(right.prop);
          if (leftIsFunc !== rightIsFunc) {
            return leftIsFunc ? 1 : SORT_BEFORE;
          }
        }
        const leftKey = getPropertyKeyName(left.prop);
        const rightKey = getPropertyKeyName(right.prop);
        let res = compareKeys(leftKey, rightKey);
        if (order === "desc") {
          res = -res;
        }
        return res;
      });
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
    const getFixableProps = (node) => node.properties.filter((prop) => prop.type === "Property" && !prop.computed && (prop.key.type === "Identifier" || prop.key.type === "Literal"));
    const checkObjectExpression = (node) => {
      if (node.properties.length < minKeys) {
        return;
      }
      let autoFixable = true;
      const keys = node.properties.map((prop) => {
        let keyName = null;
        let isFunc = false;
        if (prop.type !== "Property") {
          autoFixable = false;
          return {
            isFunction: isFunc,
            keyName,
            node: prop
          };
        }
        if (prop.computed) {
          autoFixable = false;
        }
        if (prop.key.type === "Identifier") {
          keyName = prop.key.name;
        } else if (prop.key.type === "Literal") {
          const { value } = prop.key;
          keyName = typeof value === "string" ? value : String(value);
        } else {
          autoFixable = false;
        }
        if (isFunctionProperty(prop)) {
          isFunc = true;
        }
        return {
          isFunction: isFunc,
          keyName,
          node: prop
        };
      });
      let fixProvided = false;
      const createReportWithFix = (curr, shouldFix) => {
        context.report({
          fix: shouldFix ? (fixer) => {
            const fixableProps = getFixableProps(node);
            if (fixableProps.length < minKeys) {
              return null;
            }
            const [firstProp] = fixableProps;
            const lastProp = fixableProps[fixableProps.length - 1];
            if (!firstProp || !lastProp) {
              return null;
            }
            const firstLeading = getLeadingComments(firstProp, null);
            const [firstLeadingComment] = firstLeading;
            const rangeStart = firstLeadingComment ? firstLeadingComment.range[0] : firstProp.range[0];
            const lastTrailing = getTrailingComments(lastProp, null);
            const rangeEnd = lastTrailing.length > 0 ? lastTrailing[lastTrailing.length - 1].range[1] : lastProp.range[1];
            const sortedText = buildSortedText(fixableProps, rangeStart);
            return fixer.replaceTextRange([rangeStart, rangeEnd], sortedText);
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
          variablesBeforeFunctions: {
            type: "boolean"
          }
        },
        type: "object"
      }
    ],
    type: "suggestion"
  }
};

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
var noTransitionCSSProperties = {
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
  }
};

// src/rules/no-explicit-return-types.ts
var noExplicitReturnTypes = {
  create(context) {
    const hasSingleObjectReturn = (body) => {
      const returnStatements = body.body.filter((stmt) => stmt.type === "ReturnStatement");
      if (returnStatements.length !== 1) {
        return false;
      }
      const [returnStmt] = returnStatements;
      return returnStmt?.argument?.type === "ObjectExpression";
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
      description: "Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects)."
    },
    messages: {
      noExplicitReturnType: "Explicit return types are disallowed; rely on TypeScript's inference instead."
    },
    schema: [],
    type: "suggestion"
  }
};

// src/rules/max-jsx-nesting.ts
var isJSXAncestor = (node) => node.type === "JSXElement" || node.type === "JSXFragment";
var maxJSXNesting = {
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
  }
};

// src/rules/seperate-style-files.ts
var seperateStyleFiles = {
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
  }
};

// src/rules/no-unnecessary-key.ts
var isMapCallExpression = (node) => {
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") {
    return false;
  }
  const { property } = node.callee;
  return property.type === "Identifier" && property.name === "map" || property.type === "Literal" && property.value === "map";
};
var noUnnecessaryKey = {
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
  }
};

// src/rules/sort-exports.ts
var SORT_BEFORE2 = -1;
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
var sortExports = {
  create(context) {
    const { sourceCode } = context;
    const [option] = context.options;
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
    const generateExportText = (node) => sourceCode.getText(node).trim().replace(/\s*;?\s*$/, ";");
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
    const hasForwardDependency = (node, laterNames) => {
      const text = sourceCode.getText(node);
      for (const name of laterNames) {
        if (text.includes(name)) {
          return true;
        }
      }
      return false;
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
        text: sourceCode.getText(node)
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
    const checkForwardDependencies = (items) => {
      const exportNames = items.map((item) => item.name);
      return items.some((item, idx) => {
        const laterNames = new Set(exportNames.slice(idx + 1));
        const nodeToCheck = item.node.declaration ?? item.node;
        return hasForwardDependency(nodeToCheck, laterNames);
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
      if (checkForwardDependencies(items)) {
        return;
      }
      const sortedItems = items.slice().sort(sortComparator);
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
          const [rangeStart] = firstNode.range;
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
  }
};

// src/rules/localize-react-props.ts
import { AST_NODE_TYPES as AST_NODE_TYPES2 } from "@typescript-eslint/utils";
var localizeReactProps = {
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
      while (current.type === AST_NODE_TYPES2.JSXMemberExpression) {
        current = current.property;
      }
      if (current.type === AST_NODE_TYPES2.JSXIdentifier) {
        return current;
      }
      return null;
    };
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
    const getJSXElementName = (jsxElement) => {
      if (!jsxElement || !jsxElement.openingElement || !jsxElement.openingElement.name) {
        return "";
      }
      const nameNode = jsxElement.openingElement.name;
      if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
        return nameNode.name;
      }
      const rightmost = getRightmostJSXIdentifier(nameNode);
      if (rightmost) {
        return rightmost.name;
      }
      return "";
    };
    const isUseStateCall = (node) => node !== null && node.type === AST_NODE_TYPES2.CallExpression && node.callee !== null && (node.callee.type === AST_NODE_TYPES2.Identifier && node.callee.name === "useState" || node.callee.type === AST_NODE_TYPES2.MemberExpression && node.callee.property !== null && node.callee.property.type === AST_NODE_TYPES2.Identifier && node.callee.property.name === "useState");
    const isHookCall = (node) => node !== null && node.type === AST_NODE_TYPES2.CallExpression && node.callee !== null && node.callee.type === AST_NODE_TYPES2.Identifier && /^use[A-Z]/.test(node.callee.name) && node.callee.name !== "useState";
    const getJSXAncestor = (node) => {
      let current = node.parent;
      while (current) {
        if (current.type === AST_NODE_TYPES2.JSXElement) {
          return current;
        }
        current = current.parent;
      }
      return null;
    };
    const getTagNameFromOpening = (openingElement) => {
      const nameNode = openingElement.name;
      if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
        return nameNode.name;
      }
      const rightmost = getRightmostJSXIdentifier(nameNode);
      return rightmost ? rightmost.name : null;
    };
    const isProviderOrContext = (tagName) => tagName.endsWith("Provider") || tagName.endsWith("Context");
    const isValueAttributeOnProvider = (node) => node.type === AST_NODE_TYPES2.JSXAttribute && node.name && node.name.type === AST_NODE_TYPES2.JSXIdentifier && node.name.name === "value" && node.parent && node.parent.type === AST_NODE_TYPES2.JSXOpeningElement && (() => {
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
      if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
        return /^[A-Z]/.test(nameNode.name);
      }
      const leftmost = getLeftmostJSXIdentifier(nameNode);
      return leftmost !== null && /^[A-Z]/.test(leftmost.name);
    };
    const getComponentFunction = (node) => {
      let current = node;
      while (current) {
        if (current.type === AST_NODE_TYPES2.FunctionDeclaration || current.type === AST_NODE_TYPES2.FunctionExpression || current.type === AST_NODE_TYPES2.ArrowFunctionExpression) {
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
      if (!node.init || !isUseStateCall(node.init) || node.id.type !== AST_NODE_TYPES2.ArrayPattern || node.id.elements.length < 2) {
        return false;
      }
      const [stateElem, setterElem] = node.id.elements;
      if (!stateElem || stateElem.type !== AST_NODE_TYPES2.Identifier || !setterElem || setterElem.type !== AST_NODE_TYPES2.Identifier) {
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
      if (!node.id || node.id.type !== AST_NODE_TYPES2.Identifier) {
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
        if (node.init && node.id && node.id.type === AST_NODE_TYPES2.Identifier && node.init.type === AST_NODE_TYPES2.CallExpression && isHookCall(node.init)) {
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
  }
};

// src/rules/no-or-none-component.ts
var noOrNoneComponent = {
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
  }
};

// src/rules/no-button-navigation.ts
var noButtonNavigation = {
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
  }
};

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
var noMultiStyleObjects = {
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
  }
};

// src/rules/no-useless-function.ts
var noUselessFunction = {
  create(context) {
    const isCallbackFunction = (node) => {
      const { parent } = node;
      if (!parent || parent.type !== "CallExpression") {
        return false;
      }
      for (const arg of parent.arguments) {
        if (arg === node) {
          return true;
        }
      }
      return false;
    };
    return {
      ArrowFunctionExpression(node) {
        if (node.params.length === 0 && node.body && node.body.type === "ObjectExpression") {
          if (isCallbackFunction(node)) {
            return;
          }
          context.report({
            messageId: "uselessFunction",
            node
          });
        }
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
  }
};

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
var minVarLength = {
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
  }
};

// src/rules/max-depth-extended.ts
var maxDepthExtended = {
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
  }
};

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
var springNamingConvention = {
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
  }
};

// src/rules/inline-style-limit.ts
var DEFAULT_MAX_KEYS = 3;
var inlineStyleLimit = {
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
  }
};

// src/rules/no-inline-prop-types.ts
var noInlinePropTypes = {
  create(context) {
    const checkParameter = (param) => {
      if (param.type !== "ObjectPattern" || !param.typeAnnotation || param.typeAnnotation.type !== "TSTypeAnnotation") {
        return;
      }
      const annotation = param.typeAnnotation.typeAnnotation;
      if (annotation.type === "TSTypeLiteral") {
        context.report({
          messageId: "noInlinePropTypes",
          node: param
        });
      }
    };
    return {
      "FunctionDeclaration, ArrowFunctionExpression, FunctionExpression"(node) {
        if (node.params.length === 0) {
          return;
        }
        const [firstParam] = node.params;
        if (!firstParam) {
          return;
        }
        checkParameter(firstParam);
      }
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Enforce that component prop types are not defined inline (using an object literal) but rather use a named type or interface."
    },
    messages: {
      noInlinePropTypes: "Inline prop type definitions are not allowed. Use a named type alias or interface instead of an inline object type."
    },
    schema: [],
    type: "suggestion"
  }
};

// src/rules/no-unnecessary-div.ts
import { AST_NODE_TYPES as AST_NODE_TYPES3 } from "@typescript-eslint/utils";
var noUnnecessaryDiv = {
  create(context) {
    const isDivElement = (node) => {
      const nameNode = node.openingElement.name;
      return nameNode.type === AST_NODE_TYPES3.JSXIdentifier && nameNode.name === "div";
    };
    const isMeaningfulChild = (child) => {
      if (child.type === AST_NODE_TYPES3.JSXText) {
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
        if (onlyChild.type === AST_NODE_TYPES3.JSXElement) {
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
  }
};

// src/index.ts
var src_default = {
  rules: {
    "explicit-object-types": explicitObjectTypes,
    "inline-style-limit": inlineStyleLimit,
    "localize-react-props": localizeReactProps,
    "max-depth-extended": maxDepthExtended,
    "max-jsxnesting": maxJSXNesting,
    "min-var-length": minVarLength,
    "no-button-navigation": noButtonNavigation,
    "no-explicit-return-type": noExplicitReturnTypes,
    "no-inline-prop-types": noInlinePropTypes,
    "no-multi-style-objects": noMultiStyleObjects,
    "no-nested-jsx-return": noNestedJSXReturn,
    "no-or-none-component": noOrNoneComponent,
    "no-transition-cssproperties": noTransitionCSSProperties,
    "no-unnecessary-div": noUnnecessaryDiv,
    "no-unnecessary-key": noUnnecessaryKey,
    "no-useless-function": noUselessFunction,
    "seperate-style-files": seperateStyleFiles,
    "sort-exports": sortExports,
    "sort-keys-fixable": sortKeysFixable,
    "spring-naming-convention": springNamingConvention
  }
};
export {
  src_default as default
};
