// @bun
// src/rules/no-nested-jsx-return.ts
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
var noNestedJSXReturn = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow nested functions that return non-component, non-singular JSX to enforce one component per file"
    },
    schema: [],
    messages: {
      nestedFunctionJSX: "Nested function returning non-component, non-singular JSX detected. Extract it into its own component.",
      nestedArrowJSX: "Nested arrow function returning non-component, non-singular JSX detected. Extract it into its own component.",
      nestedArrowFragment: "Nested arrow function returning a non-singular JSX fragment detected. Extract it into its own component."
    }
  },
  defaultOptions: [],
  create(context) {
    function isJSX(node) {
      return !!node && (node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment);
    }
    function getLeftmostJSXIdentifier(name) {
      let current = name;
      while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
        current = current.object;
      }
      if (current.type === AST_NODE_TYPES.JSXIdentifier) {
        return current;
      }
      return null;
    }
    function isJSXComponentElement(node) {
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
    }
    function isSingularJSXReturn(node) {
      if (!isJSX(node))
        return false;
      const children = node.children.filter((child) => {
        if (child.type === AST_NODE_TYPES.JSXText) {
          return child.value.trim() !== "";
        }
        return true;
      });
      if (children.length === 0) {
        return true;
      }
      if (children.length === 1) {
        const child = children[0];
        if (!child) {
          return false;
        }
        if (child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXFragment) {
          const innerChildren = child.children.filter((innerChild) => {
            if (innerChild.type === AST_NODE_TYPES.JSXText) {
              return innerChild.value.trim() !== "";
            }
            return true;
          });
          return innerChildren.length === 0;
        }
        return true;
      }
      return false;
    }
    const functionStack = [];
    function pushFunction(node) {
      functionStack.push(node);
    }
    function popFunction() {
      functionStack.pop();
    }
    return {
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        pushFunction(node);
      },
      "FunctionDeclaration:exit"(_node) {
        popFunction();
      },
      "FunctionExpression:exit"(_node) {
        popFunction();
      },
      "ArrowFunctionExpression:exit"(_node) {
        popFunction();
      },
      ReturnStatement(node) {
        if (functionStack.length <= 1) {
          return;
        }
        const argument = node.argument;
        if (!isJSX(argument)) {
          return;
        }
        if (!isJSXComponentElement(argument) && !isSingularJSXReturn(argument)) {
          context.report({
            node,
            messageId: "nestedFunctionJSX"
          });
        }
      },
      "ArrowFunctionExpression > JSXElement"(node) {
        if (functionStack.length <= 1) {
          return;
        }
        if (!isJSXComponentElement(node) && !isSingularJSXReturn(node)) {
          context.report({
            node,
            messageId: "nestedArrowJSX"
          });
        }
      },
      "ArrowFunctionExpression > JSXFragment"(node) {
        if (functionStack.length <= 1) {
          return;
        }
        if (!isSingularJSXReturn(node)) {
          context.report({
            node,
            messageId: "nestedArrowFragment"
          });
        }
      }
    };
  }
};

// src/rules/explicit-object-types.ts
var explicitObjectTypes = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit type annotations for object literals and arrays of object literals"
    },
    schema: [],
    messages: {
      objectLiteralNeedsType: "Object literal must have an explicit type annotation.",
      arrayOfObjectLiteralsNeedsType: "Array of object literals must have an explicit type annotation."
    }
  },
  defaultOptions: [],
  create(context) {
    function isObjectLiteral(node) {
      return !!node && node.type === "ObjectExpression";
    }
    return {
      VariableDeclarator(node) {
        if (!node.init)
          return;
        if (node.id.type === "Identifier" && node.id.typeAnnotation)
          return;
        if (isObjectLiteral(node.init)) {
          if (node.id.type === "Identifier") {
            context.report({
              node: node.id,
              messageId: "objectLiteralNeedsType"
            });
          }
          return;
        }
        if (node.init.type === "ArrayExpression") {
          const hasObjectLiteral = node.init.elements.some((element) => {
            if (!element || element.type === "SpreadElement")
              return false;
            return isObjectLiteral(element);
          });
          if (hasObjectLiteral && node.id.type === "Identifier") {
            context.report({
              node: node.id,
              messageId: "arrayOfObjectLiteralsNeedsType"
            });
          }
        }
      }
    };
  }
};

// src/rules/sort-keys-fixable.ts
var sortKeysFixable = {
  meta: {
    type: "suggestion",
    docs: {
      description: "enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)"
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          order: {
            type: "string",
            enum: ["asc", "desc"]
          },
          caseSensitive: {
            type: "boolean"
          },
          natural: {
            type: "boolean"
          },
          minKeys: {
            type: "integer",
            minimum: 2
          },
          variablesBeforeFunctions: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      unsorted: "Object keys are not sorted."
    }
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const option = context.options[0];
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
    function compareKeys(a, b) {
      let keyA = a;
      let keyB = b;
      if (!caseSensitive) {
        keyA = keyA.toLowerCase();
        keyB = keyB.toLowerCase();
      }
      if (natural) {
        return keyA.localeCompare(keyB, undefined, {
          numeric: true
        });
      }
      return keyA.localeCompare(keyB);
    }
    function isFunctionProperty(prop) {
      const value = prop.value;
      return !!value && (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression" || prop.method === true);
    }
    function getPropertyKeyName(prop) {
      const key = prop.key;
      if (key.type === "Identifier") {
        return key.name;
      }
      if (key.type === "Literal") {
        const value = key.value;
        if (typeof value === "string") {
          return value;
        }
        return String(value);
      }
      return "";
    }
    function getLeadingComments(prop, prevProp) {
      const comments = sourceCode.getCommentsBefore(prop);
      if (!prevProp || comments.length === 0) {
        return comments;
      }
      return comments.filter((c) => c.loc.start.line !== prevProp.loc.end.line);
    }
    function getTrailingComments(prop, nextProp) {
      const after = sourceCode.getCommentsAfter(prop).filter((c) => c.loc.start.line === prop.loc.end.line);
      if (nextProp) {
        const beforeNext = sourceCode.getCommentsBefore(nextProp);
        const trailingOfPrev = beforeNext.filter((c) => c.loc.start.line === prop.loc.end.line);
        for (const c of trailingOfPrev) {
          if (!after.some((a) => a.range[0] === c.range[0])) {
            after.push(c);
          }
        }
      }
      return after;
    }
    function buildSortedText(fixableProps, rangeStart) {
      const chunks = [];
      for (let i = 0;i < fixableProps.length; i++) {
        const prop = fixableProps[i];
        const prevProp = i > 0 ? fixableProps[i - 1] : null;
        const nextProp = i < fixableProps.length - 1 ? fixableProps[i + 1] : null;
        const leading = getLeadingComments(prop, prevProp);
        const trailing = getTrailingComments(prop, nextProp);
        const fullStart = leading.length > 0 ? leading[0].range[0] : prop.range[0];
        const fullEnd = trailing.length > 0 ? trailing[trailing.length - 1].range[1] : prop.range[1];
        let chunkStart;
        if (i === 0) {
          chunkStart = rangeStart;
        } else {
          const prevTrailing = getTrailingComments(prevProp, prop);
          const prevEnd = prevTrailing.length > 0 ? prevTrailing[prevTrailing.length - 1].range[1] : prevProp.range[1];
          const tokenAfterPrev = sourceCode.getTokenAfter({
            range: [prevEnd, prevEnd]
          }, { includeComments: false });
          if (tokenAfterPrev && tokenAfterPrev.value === "," && tokenAfterPrev.range[1] <= fullStart) {
            chunkStart = tokenAfterPrev.range[1];
          } else {
            chunkStart = prevEnd;
          }
        }
        const text = sourceCode.text.slice(chunkStart, fullEnd);
        chunks.push({ prop, text });
      }
      const sorted = chunks.slice().sort((a, b) => {
        if (variablesBeforeFunctions) {
          const aIsFunc = isFunctionProperty(a.prop);
          const bIsFunc = isFunctionProperty(b.prop);
          if (aIsFunc !== bIsFunc) {
            return aIsFunc ? 1 : -1;
          }
        }
        const aKey = getPropertyKeyName(a.prop);
        const bKey = getPropertyKeyName(b.prop);
        let res = compareKeys(aKey, bKey);
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
` + indent;
      } else {
        separator = ", ";
      }
      return sorted.map((chunk, i) => {
        if (i === 0) {
          const originalFirstChunk = chunks[0];
          const originalLeadingWs = originalFirstChunk.text.match(/^(\s*)/)?.[1] ?? "";
          const stripped2 = chunk.text.replace(/^\s*/, "");
          return originalLeadingWs + stripped2;
        }
        const stripped = chunk.text.replace(/^\s*/, "");
        return separator + stripped;
      }).join("");
    }
    function checkObjectExpression(node) {
      if (node.properties.length < minKeys) {
        return;
      }
      let autoFixable = true;
      const keys = node.properties.map((prop) => {
        let keyName = null;
        let isFunc = false;
        if (prop.type === "Property") {
          if (prop.computed) {
            autoFixable = false;
          }
          if (prop.key.type === "Identifier") {
            keyName = prop.key.name;
          } else if (prop.key.type === "Literal") {
            const value = prop.key.value;
            keyName = typeof value === "string" ? value : String(value);
          } else {
            autoFixable = false;
          }
          if (isFunctionProperty(prop)) {
            isFunc = true;
          }
        } else {
          autoFixable = false;
        }
        return {
          keyName,
          node: prop,
          isFunction: isFunc
        };
      });
      const getFixableProps = () => {
        const props = [];
        for (const prop of node.properties) {
          if (prop.type !== "Property") {
            continue;
          }
          if (prop.computed) {
            continue;
          }
          if (prop.key.type !== "Identifier" && prop.key.type !== "Literal") {
            continue;
          }
          props.push(prop);
        }
        return props;
      };
      let fixProvided = false;
      for (let i = 1;i < keys.length; i++) {
        const prev = keys[i - 1];
        const curr = keys[i];
        if (!prev || !curr) {
          continue;
        }
        if (prev.keyName === null || curr.keyName === null) {
          continue;
        }
        const shouldFix = !fixProvided && autoFixable;
        const reportWithFix = () => {
          context.report({
            node: curr.node.type === "Property" ? curr.node.key : curr.node,
            messageId: "unsorted",
            fix: shouldFix ? (fixer) => {
              const fixableProps = getFixableProps();
              if (fixableProps.length < minKeys) {
                return null;
              }
              const firstProp = fixableProps[0];
              const lastProp = fixableProps[fixableProps.length - 1];
              if (!firstProp || !lastProp) {
                return null;
              }
              const firstLeading = getLeadingComments(firstProp, null);
              const rangeStart = firstLeading.length > 0 ? firstLeading[0].range[0] : firstProp.range[0];
              const lastTrailing = getTrailingComments(lastProp, null);
              const rangeEnd = lastTrailing.length > 0 ? lastTrailing[lastTrailing.length - 1].range[1] : lastProp.range[1];
              const sortedText = buildSortedText(fixableProps, rangeStart);
              return fixer.replaceTextRange([rangeStart, rangeEnd], sortedText);
            } : null
          });
          fixProvided = true;
        };
        if (variablesBeforeFunctions) {
          if (prev.isFunction && !curr.isFunction) {
            reportWithFix();
            continue;
          }
          if (prev.isFunction === curr.isFunction && compareKeys(prev.keyName, curr.keyName) > 0) {
            reportWithFix();
          }
        } else {
          if (compareKeys(prev.keyName, curr.keyName) > 0) {
            reportWithFix();
          }
        }
      }
    }
    function checkJSXAttributeObject(attr) {
      const value = attr.value;
      if (value && value.type === "JSXExpressionContainer") {
        const expr = value.expression;
        if (expr && expr.type === "ObjectExpression") {
          checkObjectExpression(expr);
        }
      }
    }
    function checkJSXOpeningElement(node) {
      const attrs = node.attributes;
      if (attrs.length < minKeys) {
        return;
      }
      if (attrs.some((a) => a.type !== "JSXAttribute")) {
        return;
      }
      if (attrs.some((a) => a.type === "JSXAttribute" && a.name.type !== "JSXIdentifier")) {
        return;
      }
      const names = attrs.map((a) => {
        if (a.type !== "JSXAttribute") {
          return "";
        }
        if (a.name.type !== "JSXIdentifier") {
          return "";
        }
        return a.name.name;
      });
      const cmp = (a, b) => {
        let res = compareKeys(a, b);
        if (order === "desc") {
          res = -res;
        }
        return res;
      };
      let outOfOrder = false;
      for (let i = 1;i < names.length; i++) {
        const prevName = names[i - 1];
        const currName = names[i];
        if (!prevName || !currName) {
          continue;
        }
        if (cmp(prevName, currName) > 0) {
          outOfOrder = true;
          break;
        }
      }
      if (!outOfOrder) {
        return;
      }
      for (let i = 1;i < attrs.length; i++) {
        const prevAttr = attrs[i - 1];
        const currAttr = attrs[i];
        if (!prevAttr || !currAttr) {
          continue;
        }
        const between = sourceCode.text.slice(prevAttr.range[1], currAttr.range[0]);
        if (between.includes("{")) {
          context.report({
            node: currAttr.type === "JSXAttribute" ? currAttr.name : currAttr,
            messageId: "unsorted"
          });
          return;
        }
      }
      const sortedAttrs = attrs.slice().sort((a, b) => {
        const aName = a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" ? a.name.name : "";
        const bName = b.type === "JSXAttribute" && b.name.type === "JSXIdentifier" ? b.name.name : "";
        return cmp(aName, bName);
      });
      const firstAttr = attrs[0];
      const lastAttr = attrs[attrs.length - 1];
      if (!firstAttr || !lastAttr) {
        return;
      }
      const replacement = sortedAttrs.map((a) => sourceCode.getText(a)).join(" ");
      context.report({
        node: firstAttr.type === "JSXAttribute" ? firstAttr.name : firstAttr,
        messageId: "unsorted",
        fix(fixer) {
          return fixer.replaceTextRange([firstAttr.range[0], lastAttr.range[1]], replacement);
        }
      });
    }
    return {
      ObjectExpression: checkObjectExpression,
      JSXAttribute(node) {
        checkJSXAttributeObject(node);
      },
      JSXOpeningElement: checkJSXOpeningElement
    };
  }
};

// src/rules/no-transition-cssproperties.ts
var noTransitionCSSProperties = {
  meta: {
    type: "problem",
    docs: {
      description: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
    },
    schema: [],
    messages: {
      forbiddenTransition: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
    }
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier" || !node.id.typeAnnotation) {
          return;
        }
        let isStyleType = false;
        const typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        if (typeAnnotation && typeAnnotation.type === "TSTypeReference") {
          const typeName = typeAnnotation.typeName;
          if (typeName.type === "Identifier" && typeName.name === "CSSProperties") {
            isStyleType = true;
          } else if (typeName.type === "TSQualifiedName" && typeName.right && typeName.right.type === "Identifier" && typeName.right.name === "CSSProperties") {
            isStyleType = true;
          }
        }
        if (!isStyleType) {
          const annotationText = sourceCode.getText(node.id.typeAnnotation);
          if (annotationText.includes("CSSProperties")) {
            isStyleType = true;
          }
        }
        if (!isStyleType) {
          return;
        }
        const init = node.init;
        if (!init || init.type !== "ObjectExpression") {
          return;
        }
        for (const prop of init.properties) {
          if (prop.type !== "Property") {
            continue;
          }
          if (prop.computed) {
            continue;
          }
          let keyName = null;
          if (prop.key.type === "Identifier") {
            keyName = prop.key.name;
          } else if (prop.key.type === "Literal") {
            if (typeof prop.key.value === "string") {
              keyName = prop.key.value;
            } else {
              keyName = String(prop.key.value);
            }
          }
          if (keyName === "transition") {
            context.report({
              node: prop,
              messageId: "forbiddenTransition"
            });
          }
        }
      }
    };
  }
};

// src/rules/no-explicit-return-types.ts
var noExplicitReturnTypes = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects)."
    },
    schema: [],
    messages: {
      noExplicitReturnType: "Explicit return types are disallowed; rely on TypeScript's inference instead."
    }
  },
  defaultOptions: [],
  create(context) {
    function hasSingleObjectReturn(body) {
      let returnCount = 0;
      let returnedObject = null;
      for (const stmt of body.body) {
        if (stmt.type === "ReturnStatement") {
          returnCount++;
          const arg = stmt.argument;
          if (arg && arg.type === "ObjectExpression") {
            returnedObject = arg;
          }
        }
      }
      return returnCount === 1 && returnedObject !== null;
    }
    return {
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        const returnType = node.returnType;
        if (!returnType) {
          return;
        }
        const typeAnnotation = returnType.typeAnnotation;
        if (typeAnnotation && typeAnnotation.type === "TSTypePredicate") {
          return;
        }
        if (node.type === "ArrowFunctionExpression" && node.expression === true && node.body.type === "ObjectExpression") {
          return;
        }
        if (node.body && node.body.type === "BlockStatement") {
          if (hasSingleObjectReturn(node.body)) {
            return;
          }
        }
        context.report({
          node: returnType,
          messageId: "noExplicitReturnType"
        });
      }
    };
  }
};

// src/rules/max-jsx-nesting.ts
var maxJSXNesting = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when JSX elements are nested too deeply, suggesting refactoring into a separate component."
    },
    schema: [
      {
        type: "number",
        minimum: 1
      }
    ],
    messages: {
      tooDeeplyNested: "JSX element is nested too deeply ({{level}} levels, allowed is {{maxAllowed}} levels). Consider refactoring into a separate component."
    }
  },
  defaultOptions: [1],
  create(context) {
    const option = context.options[0];
    const maxAllowed = typeof option === "number" ? option : 1;
    function getJSXNestingLevel(node) {
      let level = 1;
      let current = node.parent;
      while (current) {
        if (current.type === "JSXElement" || current.type === "JSXFragment") {
          level++;
        }
        current = current.parent;
      }
      return level;
    }
    return {
      JSXElement(node) {
        const level = getJSXNestingLevel(node);
        if (level > maxAllowed) {
          context.report({
            node,
            messageId: "tooDeeplyNested",
            data: { level, maxAllowed }
          });
        }
      }
    };
  }
};

// src/rules/seperate-style-files.ts
var seperateStyleFiles = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when a component file (.jsx or .tsx) contains a style object typed as CSSProperties. " + "Style objects should be moved to their own file under the style folder."
    },
    schema: [],
    messages: {
      moveToFile: 'Style object "{{name}}" is typed as {{typeName}}. Move it to its own file under the style folder.'
    }
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
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
          const right = typeNameNode.right;
          typeName = right.name;
        }
        if (typeName === "CSSProperties") {
          context.report({
            node,
            messageId: "moveToFile",
            data: {
              name: identifier.name,
              typeName
            }
          });
        }
      }
    };
  }
};

// src/rules/no-unnecessary-key.ts
var noUnnecessaryKey = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce that the key prop is only used on components rendered as part of a mapping"
    },
    schema: [],
    messages: {
      unnecessaryKey: "The key prop should only be used on elements that are directly rendered as part of an array mapping."
    }
  },
  defaultOptions: [],
  create(context) {
    function getAncestors(node) {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    }
    function isInsideMapCall(ancestors) {
      for (const node of ancestors) {
        if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
          const property = node.callee.property;
          if (property.type === "Identifier" && property.name === "map") {
            return true;
          }
          if (property.type === "Literal" && property.value === "map") {
            return true;
          }
        }
      }
      return false;
    }
    function isReturnedFromFunction(ancestors) {
      for (const node of ancestors) {
        if (node.type === "ReturnStatement") {
          return true;
        }
      }
      return false;
    }
    function checkJSXOpeningElement(node) {
      const keyAttribute = node.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === "key");
      if (!keyAttribute) {
        return;
      }
      let ancestors;
      if (typeof context.getAncestors === "function") {
        ancestors = context.getAncestors();
      } else {
        ancestors = getAncestors(node);
      }
      if (isInsideMapCall(ancestors)) {
        return;
      }
      if (isReturnedFromFunction(ancestors)) {
        return;
      }
      context.report({
        node: keyAttribute,
        messageId: "unnecessaryKey"
      });
    }
    return {
      JSXOpeningElement: checkJSXOpeningElement
    };
  }
};

// src/rules/sort-exports.ts
var sortExports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports"
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          order: {
            type: "string",
            enum: ["asc", "desc"]
          },
          caseSensitive: {
            type: "boolean"
          },
          natural: {
            type: "boolean"
          },
          minKeys: {
            type: "integer",
            minimum: 2
          },
          variablesBeforeFunctions: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      alphabetical: "Export declarations are not sorted alphabetically. Expected order: {{expectedOrder}}.",
      variablesBeforeFunctions: "Non-function exports should come before function exports."
    }
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const option = context.options[0];
    const order = option && option.order ? option.order : "asc";
    const caseSensitive = option && typeof option.caseSensitive === "boolean" ? option.caseSensitive : false;
    const natural = option && typeof option.natural === "boolean" ? option.natural : false;
    const minKeys = option && typeof option.minKeys === "number" ? option.minKeys : 2;
    const variablesBeforeFunctions = option && typeof option.variablesBeforeFunctions === "boolean" ? option.variablesBeforeFunctions : false;
    function generateExportText(node) {
      return sourceCode.getText(node).trim().replace(/\s*;?\s*$/, ";");
    }
    function compareStrings(a, b) {
      let strA = a;
      let strB = b;
      if (!caseSensitive) {
        strA = strA.toLowerCase();
        strB = strB.toLowerCase();
      }
      const cmp = natural ? strA.localeCompare(strB, undefined, { numeric: true }) : strA.localeCompare(strB);
      return order === "asc" ? cmp : -cmp;
    }
    function getExportName(node) {
      const declaration = node.declaration;
      if (declaration) {
        if (declaration.type === "VariableDeclaration") {
          if (declaration.declarations.length === 1) {
            const firstDeclarator = declaration.declarations[0];
            if (firstDeclarator && firstDeclarator.id.type === "Identifier") {
              return firstDeclarator.id.name;
            }
          }
        } else if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
          const id = declaration.id;
          if (id && id.type === "Identifier") {
            return id.name;
          }
        }
      } else if (node.specifiers.length === 1) {
        const spec = node.specifiers[0];
        if (!spec) {
          return null;
        }
        if (spec.exported.type === "Identifier") {
          return spec.exported.name;
        }
        if (spec.exported.type === "Literal" && typeof spec.exported.value === "string") {
          return spec.exported.value;
        }
      }
      return null;
    }
    function isFunctionExport(node) {
      const declaration = node.declaration;
      if (!declaration) {
        return false;
      }
      if (declaration.type === "VariableDeclaration") {
        if (declaration.declarations.length === 1) {
          const firstDeclarator = declaration.declarations[0];
          if (!firstDeclarator) {
            return false;
          }
          const init = firstDeclarator.init;
          if (!init) {
            return false;
          }
          return init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression";
        }
        return false;
      }
      if (declaration.type === "FunctionDeclaration") {
        return true;
      }
      return false;
    }
    function sortComparator(a, b) {
      const kindA = a.node.exportKind ?? "value";
      const kindB = b.node.exportKind ?? "value";
      if (kindA !== kindB) {
        return kindA === "type" ? -1 : 1;
      }
      if (variablesBeforeFunctions) {
        if (a.isFunction !== b.isFunction) {
          return a.isFunction ? 1 : -1;
        }
      }
      return compareStrings(a.name, b.name);
    }
    function hasForwardDependency(node, laterNames) {
      const text = sourceCode.getText(node);
      for (const name of laterNames) {
        if (text.includes(name)) {
          return true;
        }
      }
      return false;
    }
    function processExportBlock(block) {
      if (block.length < minKeys) {
        return;
      }
      const items = [];
      for (const node of block) {
        const name = getExportName(node);
        if (!name) {
          continue;
        }
        items.push({
          name,
          node,
          isFunction: isFunctionExport(node),
          text: sourceCode.getText(node)
        });
      }
      if (items.length < minKeys) {
        return;
      }
      const sortedItems = items.slice().sort(sortComparator);
      let reportNeeded = false;
      let messageId = "alphabetical";
      for (let i = 1;i < items.length; i++) {
        const prev = items[i - 1];
        const current = items[i];
        if (!prev || !current) {
          continue;
        }
        if (sortComparator(prev, current) > 0) {
          reportNeeded = true;
          if (variablesBeforeFunctions && prev.isFunction && !current.isFunction) {
            messageId = "variablesBeforeFunctions";
          }
          break;
        }
      }
      if (!reportNeeded) {
        return;
      }
      const exportNames = items.map((item) => item.name);
      for (let i = 0;i < items.length; i++) {
        const item = items[i];
        if (!item) {
          continue;
        }
        const laterNames = new Set(exportNames.slice(i + 1));
        const nodeToCheck = item.node.declaration ?? item.node;
        if (hasForwardDependency(nodeToCheck, laterNames)) {
          return;
        }
      }
      const expectedOrder = sortedItems.map((item) => item.name).join(", ");
      const firstNode = block[0];
      const lastNode = block[block.length - 1];
      if (!firstNode || !lastNode) {
        return;
      }
      context.report({
        node: firstNode,
        messageId,
        data: {
          expectedOrder
        },
        fix(fixer) {
          const fixableNodes = [];
          for (const n of block) {
            const declaration = n.declaration;
            if (declaration) {
              if (declaration.type === "VariableDeclaration" && declaration.declarations.length === 1) {
                const firstDecl = declaration.declarations[0];
                if (firstDecl && firstDecl.id.type === "Identifier") {
                  fixableNodes.push(n);
                  continue;
                }
              }
              if ((declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") && declaration.id && declaration.id.type === "Identifier") {
                fixableNodes.push(n);
                continue;
              }
              continue;
            }
            if (n.specifiers.length === 1) {
              fixableNodes.push(n);
            }
          }
          if (fixableNodes.length < minKeys) {
            return null;
          }
          const sortedText = sortedItems.map((item) => generateExportText(item.node)).join(`
`);
          const rangeStart = firstNode.range[0];
          const rangeEnd = lastNode.range[1];
          const fullText = sourceCode.getText();
          const originalText = fullText.slice(rangeStart, rangeEnd);
          if (originalText === sortedText) {
            return null;
          }
          return fixer.replaceTextRange([rangeStart, rangeEnd], sortedText);
        }
      });
    }
    return {
      "Program:exit"(node) {
        const body = node.body;
        const block = [];
        for (let i = 0;i < body.length; i++) {
          const stmt = body[i];
          if (!stmt) {
            continue;
          }
          if (stmt.type === "ExportNamedDeclaration" && !stmt.source && getExportName(stmt) !== null) {
            block.push(stmt);
          } else {
            if (block.length > 0) {
              processExportBlock(block);
              block.length = 0;
            }
          }
        }
        if (block.length > 0) {
          processExportBlock(block);
        }
      }
    };
  }
};

// src/rules/localize-react-props.ts
import { AST_NODE_TYPES as AST_NODE_TYPES2 } from "@typescript-eslint/utils";
var localizeReactProps = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate \u2013 if two or more are passed to the same component type, they\u2019re assumed to be settings that belong on the parent."
    },
    schema: [],
    messages: {
      stateAndSetterToChild: "State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
      variableToChild: "Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component."
    }
  },
  defaultOptions: [],
  create(context) {
    const candidateVariables = [];
    function getSingleSetElement(set) {
      for (const value of set) {
        return value;
      }
      return null;
    }
    function getRightmostJSXIdentifier(name) {
      let current = name;
      while (current.type === AST_NODE_TYPES2.JSXMemberExpression) {
        current = current.property;
      }
      if (current.type === AST_NODE_TYPES2.JSXIdentifier) {
        return current;
      }
      return null;
    }
    function getLeftmostJSXIdentifier(name) {
      let current = name;
      while (current.type === AST_NODE_TYPES2.JSXMemberExpression) {
        current = current.object;
      }
      if (current.type === AST_NODE_TYPES2.JSXIdentifier) {
        return current;
      }
      return null;
    }
    function getJSXElementName(jsxElement) {
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
    }
    function isUseStateCall(node) {
      return node !== null && node.type === AST_NODE_TYPES2.CallExpression && node.callee !== null && (node.callee.type === AST_NODE_TYPES2.Identifier && node.callee.name === "useState" || node.callee.type === AST_NODE_TYPES2.MemberExpression && node.callee.property !== null && node.callee.property.type === AST_NODE_TYPES2.Identifier && node.callee.property.name === "useState");
    }
    function isHookCall(node) {
      return node !== null && node.type === AST_NODE_TYPES2.CallExpression && node.callee !== null && node.callee.type === AST_NODE_TYPES2.Identifier && /^use[A-Z]/.test(node.callee.name) && node.callee.name !== "useState";
    }
    function getJSXAncestor(node) {
      let current = node.parent;
      while (current) {
        if (current.type === AST_NODE_TYPES2.JSXElement) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }
    function isContextProviderValueProp(node) {
      let current = node.parent;
      while (current) {
        if (current.type === AST_NODE_TYPES2.JSXAttribute && current.name && current.name.type === AST_NODE_TYPES2.JSXIdentifier && current.name.name === "value") {
          if (current.parent && current.parent.type === AST_NODE_TYPES2.JSXOpeningElement) {
            const nameNode = current.parent.name;
            if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
              const tagName = nameNode.name;
              if (tagName.endsWith("Provider") || tagName.endsWith("Context")) {
                return true;
              }
            } else {
              const rightmost = getRightmostJSXIdentifier(nameNode);
              if (rightmost) {
                if (rightmost.name.endsWith("Provider") || rightmost.name.endsWith("Context")) {
                  return true;
                }
              }
            }
          }
        }
        current = current.parent;
      }
      return false;
    }
    function isCustomJSXElement(jsxElement) {
      if (!jsxElement || !jsxElement.openingElement || !jsxElement.openingElement.name) {
        return false;
      }
      const nameNode = jsxElement.openingElement.name;
      if (nameNode.type === AST_NODE_TYPES2.JSXIdentifier) {
        return /^[A-Z]/.test(nameNode.name);
      }
      const leftmost = getLeftmostJSXIdentifier(nameNode);
      if (leftmost && /^[A-Z]/.test(leftmost.name)) {
        return true;
      }
      return false;
    }
    function getComponentFunction(node) {
      let current = node;
      while (current) {
        if (current.type === AST_NODE_TYPES2.FunctionDeclaration || current.type === AST_NODE_TYPES2.FunctionExpression || current.type === AST_NODE_TYPES2.ArrowFunctionExpression) {
          return current;
        }
        current = current.parent;
      }
      return null;
    }
    function findVariableForIdentifier(id) {
      let scope = context.sourceCode.getScope(id);
      while (scope) {
        for (const variable of scope.variables) {
          for (const def of variable.defs) {
            if (def.name === id) {
              return variable;
            }
          }
        }
        scope = scope.upper ?? null;
      }
      return null;
    }
    function analyzeVariableUsage(declarationId) {
      const variable = findVariableForIdentifier(declarationId);
      if (!variable) {
        return {
          jsxUsageSet: new Set,
          hasOutsideUsage: false
        };
      }
      const jsxUsageSet = new Set;
      let hasOutsideUsage = false;
      for (const reference of variable.references) {
        const identifier = reference.identifier;
        if (identifier === declarationId) {
          continue;
        }
        if (isContextProviderValueProp(identifier)) {
          continue;
        }
        const jsxAncestor = getJSXAncestor(identifier);
        if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
          jsxUsageSet.add(jsxAncestor);
        } else {
          hasOutsideUsage = true;
        }
      }
      return {
        jsxUsageSet,
        hasOutsideUsage
      };
    }
    const componentHookVars = new WeakMap;
    function getHookSet(componentFunction) {
      let hookSet = componentHookVars.get(componentFunction);
      if (!hookSet) {
        hookSet = new Set;
        componentHookVars.set(componentFunction, hookSet);
      }
      return hookSet;
    }
    function hasHookDependency(node, hookSet) {
      if (!node.range) {
        return false;
      }
      const nodeRange = node.range;
      const nodeStart = nodeRange[0];
      const nodeEnd = nodeRange[1];
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        for (const variable of scope.variables) {
          if (!hookSet.has(variable.name)) {
            continue;
          }
          for (const reference of variable.references) {
            const identifier = reference.identifier;
            if (!identifier.range) {
              continue;
            }
            const refRange = identifier.range;
            const refStart = refRange[0];
            const refEnd = refRange[1];
            if (refStart >= nodeStart && refEnd <= nodeEnd) {
              return true;
            }
          }
        }
        scope = scope.upper ?? null;
      }
      return false;
    }
    return {
      VariableDeclarator(node) {
        const componentFunction = getComponentFunction(node);
        if (!componentFunction || !componentFunction.body)
          return;
        if (node.init && node.id && node.id.type === AST_NODE_TYPES2.Identifier && node.init.type === AST_NODE_TYPES2.CallExpression && isHookCall(node.init)) {
          const hookSet = getHookSet(componentFunction);
          hookSet.add(node.id.name);
        }
        if (node.init && isUseStateCall(node.init) && node.id.type === AST_NODE_TYPES2.ArrayPattern && node.id.elements.length >= 2) {
          const stateElem = node.id.elements[0];
          const setterElem = node.id.elements[1];
          if (!stateElem || stateElem.type !== AST_NODE_TYPES2.Identifier || !setterElem || setterElem.type !== AST_NODE_TYPES2.Identifier) {
            return;
          }
          const stateVarName = stateElem.name;
          const setterVarName = setterElem.name;
          const stateUsage = analyzeVariableUsage(stateElem);
          const setterUsage = analyzeVariableUsage(setterElem);
          const stateExclusivelySingleJSX = !stateUsage.hasOutsideUsage && stateUsage.jsxUsageSet.size === 1;
          const setterExclusivelySingleJSX = !setterUsage.hasOutsideUsage && setterUsage.jsxUsageSet.size === 1;
          if (stateExclusivelySingleJSX && setterExclusivelySingleJSX) {
            const stateTarget = getSingleSetElement(stateUsage.jsxUsageSet);
            const setterTarget = getSingleSetElement(setterUsage.jsxUsageSet);
            if (stateTarget && stateTarget === setterTarget) {
              context.report({
                node,
                messageId: "stateAndSetterToChild",
                data: { stateVarName, setterVarName }
              });
            }
          }
        } else if (node.id && node.id.type === AST_NODE_TYPES2.Identifier) {
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
              node,
              varName,
              componentName
            });
          }
        }
      },
      "Program:exit"() {
        const groups = new Map;
        for (const candidate of candidateVariables) {
          const key = candidate.componentName;
          const existing = groups.get(key);
          if (existing) {
            existing.push(candidate);
          } else {
            groups.set(key, [candidate]);
          }
        }
        for (const candidates of groups.values()) {
          if (candidates.length === 1) {
            const candidate = candidates[0];
            if (!candidate) {
              continue;
            }
            context.report({
              node: candidate.node,
              messageId: "variableToChild",
              data: { varName: candidate.varName }
            });
          }
        }
      }
    };
  }
};

// src/rules/no-or-none-component.ts
var noOrNoneComponent = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer using logical && operator over ternary with null/undefined for conditional JSX rendering."
    },
    schema: [],
    messages: {
      useLogicalAnd: "Prefer using the logical '&&' operator instead of a ternary with null/undefined for conditional rendering."
    }
  },
  defaultOptions: [],
  create(context) {
    return {
      ConditionalExpression(node) {
        const alternate = node.alternate;
        const isNullAlternate = alternate && alternate.type === "Literal" && alternate.value === null;
        const isUndefinedAlternate = alternate && alternate.type === "Identifier" && alternate.name === "undefined";
        if (!isNullAlternate && !isUndefinedAlternate) {
          return;
        }
        const parent = node.parent;
        if (!parent || parent.type !== "JSXExpressionContainer") {
          return;
        }
        const containerParent = parent.parent;
        if (containerParent && containerParent.type !== "JSXAttribute") {
          context.report({
            node,
            messageId: "useLogicalAnd"
          });
        }
      }
    };
  }
};

// src/rules/no-button-navigation.ts
var noButtonNavigation = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + \u2026)."
    },
    schema: [],
    messages: {
      noButtonNavigation: "Use an anchor tag for navigation instead of a button whose onClick handler changes the path. Detected: {{reason}}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed."
    }
  },
  defaultOptions: [],
  create(context) {
    const handlerStack = [];
    function getCurrentHandler() {
      const state = handlerStack[handlerStack.length - 1];
      if (!state) {
        return null;
      }
      return state;
    }
    function isOnClickButtonHandler(node) {
      const parent = node.parent;
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
      const openingElement = openingElementCandidate;
      const tagNameNode = openingElement.name;
      if (tagNameNode.type !== "JSXIdentifier" || tagNameNode.name !== "button") {
        return null;
      }
      return attr;
    }
    function isWindowLocationMember(member) {
      const object = member.object;
      if (object.type !== "MemberExpression") {
        return false;
      }
      const outerObject = object.object;
      const outerProperty = object.property;
      if (outerObject.type === "Identifier" && outerObject.name === "window" && outerProperty.type === "Identifier" && outerProperty.name === "location") {
        return true;
      }
      return false;
    }
    function isWindowHistoryMember(member) {
      const object = member.object;
      if (object.type !== "MemberExpression") {
        return false;
      }
      const outerObject = object.object;
      const outerProperty = object.property;
      if (outerObject.type === "Identifier" && outerObject.name === "window" && outerProperty.type === "Identifier" && outerProperty.name === "history") {
        return true;
      }
      return false;
    }
    return {
      ArrowFunctionExpression(node) {
        const attr = isOnClickButtonHandler(node);
        if (!attr) {
          return;
        }
        handlerStack.push({
          attribute: attr,
          reason: null,
          sawReplaceCall: false,
          sawAllowedLocationRead: false
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
        const reason = state.reason;
        const sawReplaceCall = state.sawReplaceCall;
        const sawAllowedLocationRead = state.sawAllowedLocationRead;
        if (reason) {
          context.report({
            node: state.attribute,
            messageId: "noButtonNavigation",
            data: { reason }
          });
          return;
        }
        if (sawReplaceCall && !sawAllowedLocationRead) {
          context.report({
            node: state.attribute,
            messageId: "noButtonNavigation",
            data: {
              reason: "history.replaceState/pushState without reading window.location"
            }
          });
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
          sawReplaceCall: false,
          sawAllowedLocationRead: false
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
        const reason = state.reason;
        const sawReplaceCall = state.sawReplaceCall;
        const sawAllowedLocationRead = state.sawAllowedLocationRead;
        if (reason) {
          context.report({
            node: state.attribute,
            messageId: "noButtonNavigation",
            data: { reason }
          });
          return;
        }
        if (sawReplaceCall && !sawAllowedLocationRead) {
          context.report({
            node: state.attribute,
            messageId: "noButtonNavigation",
            data: {
              reason: "history.replaceState/pushState without reading window.location"
            }
          });
        }
      },
      MemberExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        if (node.object.type === "Identifier" && node.object.name === "window" && node.property.type === "Identifier" && node.property.name === "open") {
          if (!state.reason) {
            state.reason = "window.open";
          }
        }
        if (isWindowLocationMember(node) && node.property.type === "Identifier" && (node.property.name === "search" || node.property.name === "pathname" || node.property.name === "hash")) {
          state.sawAllowedLocationRead = true;
        }
      },
      AssignmentExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        if (node.left.type !== "MemberExpression") {
          return;
        }
        const left = node.left;
        if (left.object.type === "Identifier" && left.object.name === "window" && left.property.type === "Identifier" && left.property.name === "location") {
          if (!state.reason) {
            state.reason = "assignment to window.location";
          }
          return;
        }
        if (isWindowLocationMember(left)) {
          if (!state.reason) {
            state.reason = "assignment to window.location sub-property";
          }
        }
      },
      CallExpression(node) {
        const state = getCurrentHandler();
        if (!state) {
          return;
        }
        const callee = node.callee;
        if (callee.type !== "MemberExpression") {
          return;
        }
        if (isWindowLocationMember(callee) && callee.property.type === "Identifier" && callee.property.name === "replace") {
          if (!state.reason) {
            state.reason = "window.location.replace";
          }
          return;
        }
        if (isWindowHistoryMember(callee) && callee.property.type === "Identifier" && (callee.property.name === "pushState" || callee.property.name === "replaceState")) {
          state.sawReplaceCall = true;
        }
      }
    };
  }
};

// src/rules/no-multi-style-objects.ts
var noMultiStyleObjects = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow grouping CSS style objects in a single export; export each style separately."
    },
    schema: [],
    messages: {
      noMultiStyleObjects: "Do not group CSS style objects in a single export; export each style separately."
    }
  },
  defaultOptions: [],
  create(context) {
    function checkObjectExpression(node) {
      if (!node.properties.length) {
        return;
      }
      const cssStyleProperties = [];
      for (const prop of node.properties) {
        if (prop.type !== "Property") {
          continue;
        }
        const key = prop.key;
        let name = null;
        if (key.type === "Identifier") {
          name = key.name;
        } else if (key.type === "Literal" && typeof key.value === "string") {
          name = key.value;
        }
        if (name && name.endsWith("Style")) {
          cssStyleProperties.push(prop);
        }
      }
      if (cssStyleProperties.length > 1) {
        context.report({
          node,
          messageId: "noMultiStyleObjects"
        });
      }
    }
    return {
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;
        if (declaration && declaration.type === "ObjectExpression") {
          checkObjectExpression(declaration);
        }
      },
      ReturnStatement(node) {
        const argument = node.argument;
        if (argument && argument.type === "ObjectExpression") {
          checkObjectExpression(argument);
        }
      }
    };
  }
};

// src/rules/no-useless-function.ts
var noUselessFunction = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring)."
    },
    schema: [],
    messages: {
      uselessFunction: "This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function."
    }
  },
  defaultOptions: [],
  create(context) {
    function isCallbackFunction(node) {
      const parent = node.parent;
      if (!parent || parent.type !== "CallExpression") {
        return false;
      }
      for (const arg of parent.arguments) {
        if (arg === node) {
          return true;
        }
      }
      return false;
    }
    return {
      ArrowFunctionExpression(node) {
        if (node.params.length === 0 && node.body && node.body.type === "ObjectExpression") {
          if (isCallbackFunction(node)) {
            return;
          }
          context.report({
            node,
            messageId: "uselessFunction"
          });
        }
      }
    };
  }
};

// src/rules/min-var-length.ts
var minVarLength = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow variable names shorter than the configured minimum length unless an outer variable with a longer name starting with the same characters exists. You can exempt specific variable names using the allowedVars option."
    },
    schema: [
      {
        type: "object",
        properties: {
          minLength: {
            type: "number",
            default: 1
          },
          allowedVars: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            },
            default: []
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      variableNameTooShort: "Variable '{{name}}' is too short. Minimum allowed length is {{minLength}} characters unless an outer variable with a longer name starting with '{{name}}' exists."
    }
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const options = context.options[0];
    const configuredMinLength = options && typeof options.minLength === "number" ? options.minLength : 1;
    const configuredAllowedVars = options && Array.isArray(options.allowedVars) ? options.allowedVars : [];
    const minLength = configuredMinLength;
    const allowedVars = configuredAllowedVars;
    function getAncestors(node) {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    }
    function getScope(node) {
      const scopeManager = sourceCode.scopeManager;
      if (!scopeManager) {
        return null;
      }
      const acquired = scopeManager.acquire(node);
      if (acquired) {
        return acquired;
      }
      return scopeManager.globalScope ?? null;
    }
    function getVariablesInNearestBlock(node) {
      let current = node.parent;
      while (current && current.type !== "BlockStatement") {
        current = current.parent;
      }
      const names = [];
      if (current && current.type === "BlockStatement" && Array.isArray(current.body)) {
        for (const stmt of current.body) {
          if (stmt.type === "VariableDeclaration") {
            for (const decl of stmt.declarations) {
              if (decl.id && decl.id.type === "Identifier") {
                names.push(decl.id.name);
              }
            }
          }
        }
      }
      return names;
    }
    function extractIdentifiersFromPattern(pattern, identifiers = []) {
      if (!pattern)
        return identifiers;
      switch (pattern.type) {
        case "Identifier":
          identifiers.push(pattern.name);
          break;
        case "ObjectPattern":
          for (const prop of pattern.properties) {
            if (prop.type === "Property") {
              extractIdentifiersFromPattern(prop.value, identifiers);
            } else if (prop.type === "RestElement") {
              extractIdentifiersFromPattern(prop.argument, identifiers);
            }
          }
          break;
        case "ArrayPattern":
          for (const element of pattern.elements) {
            if (element) {
              extractIdentifiersFromPattern(element, identifiers);
            }
          }
          break;
        case "AssignmentPattern":
          extractIdentifiersFromPattern(pattern.left, identifiers);
          break;
        default:
          break;
      }
      return identifiers;
    }
    function hasOuterCorrespondingIdentifier(shortName, node) {
      const startingScope = getScope(node);
      let outer = startingScope && startingScope.upper ? startingScope.upper : null;
      while (outer) {
        for (const variable of outer.variables) {
          if (variable.name.length >= minLength && variable.name.length > shortName.length && variable.name.startsWith(shortName)) {
            return true;
          }
        }
        outer = outer.upper;
      }
      const blockVars = getVariablesInNearestBlock(node);
      for (const name of blockVars) {
        if (name.length >= minLength && name.length > shortName.length && name.startsWith(shortName)) {
          return true;
        }
      }
      const ancestors = getAncestors(node);
      for (const anc of ancestors) {
        if (anc.type === "VariableDeclarator" && anc.id && anc.id.type === "Identifier") {
          const outerName = anc.id.name;
          if (outerName.length >= minLength && outerName.length > shortName.length && outerName.startsWith(shortName)) {
            return true;
          }
        }
        if ((anc.type === "FunctionDeclaration" || anc.type === "FunctionExpression" || anc.type === "ArrowFunctionExpression") && Array.isArray(anc.params)) {
          for (const param of anc.params) {
            const names = extractIdentifiersFromPattern(param, []);
            for (const n of names) {
              if (n.length >= minLength && n.length > shortName.length && n.startsWith(shortName)) {
                return true;
              }
            }
          }
        }
        if (anc.type === "CatchClause" && anc.param) {
          const names = extractIdentifiersFromPattern(anc.param, []);
          for (const n of names) {
            if (n.length >= minLength && n.length > shortName.length && n.startsWith(shortName)) {
              return true;
            }
          }
        }
      }
      return false;
    }
    function checkIdentifier(node) {
      const name = node.name;
      if (name.length < minLength) {
        if (allowedVars.includes(name)) {
          return;
        }
        if (!hasOuterCorrespondingIdentifier(name, node)) {
          context.report({
            node,
            messageId: "variableNameTooShort",
            data: { name, minLength }
          });
        }
      }
    }
    function checkPattern(pattern) {
      if (!pattern)
        return;
      switch (pattern.type) {
        case "Identifier":
          checkIdentifier(pattern);
          break;
        case "ObjectPattern":
          for (const prop of pattern.properties) {
            if (prop.type === "Property") {
              checkPattern(prop.value);
            } else if (prop.type === "RestElement") {
              checkPattern(prop.argument);
            }
          }
          break;
        case "ArrayPattern":
          for (const element of pattern.elements) {
            if (element) {
              checkPattern(element);
            }
          }
          break;
        case "AssignmentPattern":
          checkPattern(pattern.left);
          break;
        default:
          break;
      }
    }
    return {
      VariableDeclarator(node) {
        if (node.id) {
          checkPattern(node.id);
        }
      },
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        for (const param of node.params) {
          checkPattern(param);
        }
      },
      CatchClause(node) {
        if (node.param) {
          checkPattern(node.param);
        }
      }
    };
  }
};

// src/rules/max-depth-extended.ts
var maxDepthExtended = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow too many nested blocks except when the block only contains an early exit (return or throw)"
    },
    schema: [
      {
        type: "number"
      }
    ],
    messages: {
      tooDeep: "Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early exit."
    }
  },
  defaultOptions: [1],
  create(context) {
    const option = context.options[0];
    const maxDepth = typeof option === "number" ? option : 1;
    const functionStack = [];
    function getAncestors(node) {
      const ancestors = [];
      let current = node.parent;
      while (current) {
        ancestors.push(current);
        current = current.parent;
      }
      return ancestors;
    }
    function isEarlyExitBlock(node) {
      if (node.body.length !== 1) {
        return false;
      }
      const first = node.body[0];
      if (!first) {
        return false;
      }
      return first.type === "ReturnStatement" || first.type === "ThrowStatement";
    }
    function incrementCurrentDepth() {
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
    }
    function decrementCurrentDepth() {
      if (functionStack.length === 0) {
        return;
      }
      const index = functionStack.length - 1;
      const currentDepth = functionStack[index];
      if (typeof currentDepth !== "number") {
        return;
      }
      functionStack[index] = currentDepth - 1;
    }
    function checkDepth(node, depth) {
      if (depth > maxDepth) {
        context.report({
          node,
          messageId: "tooDeep",
          data: { depth, maxDepth }
        });
      }
    }
    return {
      FunctionDeclaration() {
        functionStack.push(0);
      },
      FunctionExpression() {
        functionStack.push(0);
      },
      ArrowFunctionExpression() {
        functionStack.push(0);
      },
      BlockStatement(node) {
        const ancestors = getAncestors(node);
        const parent = ancestors.length > 0 ? ancestors[0] : undefined;
        if (parent && (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && node === parent.body) {
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
        const ancestors = getAncestors(node);
        const parent = ancestors.length > 0 ? ancestors[0] : undefined;
        if (parent && (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && node === parent.body) {
          return;
        }
        if (isEarlyExitBlock(node)) {
          return;
        }
        decrementCurrentDepth();
      },
      "FunctionDeclaration:exit"() {
        functionStack.pop();
      },
      "FunctionExpression:exit"() {
        functionStack.pop();
      },
      "ArrowFunctionExpression:exit"() {
        functionStack.pop();
      }
    };
  }
};

// src/rules/spring-naming-convention.ts
var springNamingConvention = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce correct naming for useSpring and useSprings hook destructuring"
    },
    schema: [],
    messages: {
      firstMustEndWithSprings: "The first variable must end with 'Springs'.",
      firstMustHaveBase: "The first variable must have a non-empty name before 'Springs'.",
      secondMustMatch: "The second variable must be named '{{expected}}'.",
      pluralRequired: "The first variable for useSprings should be plural (ending with 's') before 'Springs'."
    }
  },
  defaultOptions: [],
  create(context) {
    return {
      VariableDeclarator(node) {
        const init = node.init;
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
        const elements = node.id.elements;
        if (elements.length < 2) {
          return;
        }
        const firstElem = elements[0];
        const secondElem = elements[1];
        if (!firstElem || firstElem.type !== "Identifier" || !secondElem || secondElem.type !== "Identifier") {
          return;
        }
        const firstName = firstElem.name;
        const secondName = secondElem.name;
        if (hookName === "useSpring") {
          if (!firstName.endsWith("Springs")) {
            context.report({
              node: firstElem,
              messageId: "firstMustEndWithSprings"
            });
            return;
          }
          const base = firstName.slice(0, -"Springs".length);
          if (!base) {
            context.report({
              node: firstElem,
              messageId: "firstMustHaveBase"
            });
            return;
          }
          const expectedSecond = `${base}Api`;
          if (secondName !== expectedSecond) {
            context.report({
              node: secondElem,
              messageId: "secondMustMatch",
              data: { expected: expectedSecond }
            });
          }
          return;
        }
        if (hookName === "useSprings") {
          if (!firstName.endsWith("Springs")) {
            context.report({
              node: firstElem,
              messageId: "firstMustEndWithSprings"
            });
            return;
          }
          const basePlural = firstName.slice(0, -"Springs".length);
          if (!basePlural) {
            context.report({
              node: firstElem,
              messageId: "firstMustHaveBase"
            });
            return;
          }
          if (!basePlural.endsWith("s")) {
            context.report({
              node: firstElem,
              messageId: "pluralRequired"
            });
            return;
          }
          const expectedSecond = `${basePlural}Api`;
          if (secondName !== expectedSecond) {
            context.report({
              node: secondElem,
              messageId: "secondMustMatch",
              data: { expected: expectedSecond }
            });
          }
        }
      }
    };
  }
};

// src/rules/inline-style-limit.ts
var inlineStyleLimit = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow inline style objects with too many keys and encourage extracting them"
    },
    schema: [
      {
        anyOf: [
          {
            type: "number"
          },
          {
            type: "object",
            properties: {
              maxKeys: {
                type: "number",
                description: "Maximum number of keys allowed in an inline style object before it must be extracted."
              }
            },
            additionalProperties: false
          }
        ]
      }
    ],
    messages: {
      extractStyle: "Inline style objects should be extracted into a separate object or file when containing more than {{max}} keys."
    }
  },
  defaultOptions: [3],
  create(context) {
    const option = context.options[0];
    const maxKeys = typeof option === "number" ? option : option && option.maxKeys || 3;
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") {
          return;
        }
        if (node.value && node.value.type === "JSXExpressionContainer" && node.value.expression && node.value.expression.type === "ObjectExpression") {
          const styleObject = node.value.expression;
          const keyCount = styleObject.properties.filter((prop) => prop.type === "Property").length;
          if (keyCount > maxKeys) {
            context.report({
              node,
              messageId: "extractStyle",
              data: { max: maxKeys }
            });
          }
        }
      }
    };
  }
};

// src/rules/no-inline-prop-types.ts
var noInlinePropTypes = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce that component prop types are not defined inline (using an object literal) but rather use a named type or interface."
    },
    schema: [],
    messages: {
      noInlinePropTypes: "Inline prop type definitions are not allowed. Use a named type alias or interface instead of an inline object type."
    }
  },
  defaultOptions: [],
  create(context) {
    function checkParameter(param) {
      if (param.type === "ObjectPattern" && param.typeAnnotation && param.typeAnnotation.type === "TSTypeAnnotation") {
        const annotation = param.typeAnnotation.typeAnnotation;
        if (annotation.type === "TSTypeLiteral") {
          context.report({
            node: param,
            messageId: "noInlinePropTypes"
          });
        }
      }
    }
    return {
      "FunctionDeclaration, ArrowFunctionExpression, FunctionExpression"(node) {
        if (node.params.length === 0) {
          return;
        }
        const firstParam = node.params[0];
        if (!firstParam) {
          return;
        }
        checkParameter(firstParam);
      }
    };
  }
};

// src/rules/no-unnecessary-div.ts
import { AST_NODE_TYPES as AST_NODE_TYPES3 } from "@typescript-eslint/utils";
var noUnnecessaryDiv = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed."
    },
    schema: [],
    messages: {
      unnecessaryDivWrapper: "Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose."
    }
  },
  defaultOptions: [],
  create(context) {
    function isDivElement(node) {
      const nameNode = node.openingElement.name;
      return nameNode.type === AST_NODE_TYPES3.JSXIdentifier && nameNode.name === "div";
    }
    function getMeaningfulChildren(node) {
      const result = [];
      for (const child of node.children) {
        if (child.type === AST_NODE_TYPES3.JSXText) {
          if (child.value.trim() !== "") {
            result.push(child);
          }
        } else {
          result.push(child);
        }
      }
      return result;
    }
    return {
      JSXElement(node) {
        if (!isDivElement(node)) {
          return;
        }
        const meaningfulChildren = getMeaningfulChildren(node);
        if (meaningfulChildren.length !== 1) {
          return;
        }
        const onlyChild = meaningfulChildren[0];
        if (!onlyChild) {
          return;
        }
        if (onlyChild.type === AST_NODE_TYPES3.JSXElement) {
          context.report({
            node,
            messageId: "unnecessaryDivWrapper"
          });
        }
      }
    };
  }
};

// src/index.ts
var src_default = {
  rules: {
    "no-nested-jsx-return": noNestedJSXReturn,
    "explicit-object-types": explicitObjectTypes,
    "sort-keys-fixable": sortKeysFixable,
    "no-transition-cssproperties": noTransitionCSSProperties,
    "no-explicit-return-type": noExplicitReturnTypes,
    "max-jsxnesting": maxJSXNesting,
    "seperate-style-files": seperateStyleFiles,
    "no-unnecessary-key": noUnnecessaryKey,
    "sort-exports": sortExports,
    "localize-react-props": localizeReactProps,
    "no-or-none-component": noOrNoneComponent,
    "no-button-navigation": noButtonNavigation,
    "no-multi-style-objects": noMultiStyleObjects,
    "no-useless-function": noUselessFunction,
    "min-var-length": minVarLength,
    "max-depth-extended": maxDepthExtended,
    "spring-naming-convention": springNamingConvention,
    "inline-style-limit": inlineStyleLimit,
    "no-inline-prop-types": noInlinePropTypes,
    "no-unnecessary-div": noUnnecessaryDiv
  }
};
export {
  src_default as default
};
