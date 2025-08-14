// @bun
// src/rules/no-nested-jsx-return.js
var no_nested_jsx_return_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow nested functions that return non-component, non-singular JSX to enforce one component per file",
      recommended: false
    },
    schema: []
  },
  create(context) {
    function isJSX(node) {
      return node && (node.type === "JSXElement" || node.type === "JSXFragment");
    }
    function isJSXComponentElement(node) {
      if (node && node.type === "JSXElement") {
        const opening = node.openingElement;
        if (opening && opening.name) {
          if (opening.name.type === "JSXIdentifier") {
            return /^[A-Z]/.test(opening.name.name);
          }
          if (opening.name.type === "JSXMemberExpression") {
            let current = opening.name;
            while (current && current.type === "JSXMemberExpression") {
              current = current.object;
            }
            return current && current.type === "JSXIdentifier" && /^[A-Z]/.test(current.name);
          }
        }
        return false;
      }
      return false;
    }
    function isSingularJSXReturn(node) {
      if (!isJSX(node))
        return false;
      let children = [];
      if (node.type === "JSXElement" || node.type === "JSXFragment") {
        children = node.children.filter((child) => {
          if (child.type === "JSXText") {
            return child.value.trim() !== "";
          }
          return true;
        });
        if (children.length === 1) {
          const child = children[0];
          if (child.type === "JSXElement" || child.type === "JSXFragment") {
            const innerChildren = child.children.filter((innerChild) => {
              if (innerChild.type === "JSXText") {
                return innerChild.value.trim() !== "";
              }
              return true;
            });
            return innerChildren.length === 0;
          }
          return true;
        }
        return children.length === 0;
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
      "FunctionDeclaration:exit"(node) {
        popFunction();
      },
      "FunctionExpression:exit"(node) {
        popFunction();
      },
      "ArrowFunctionExpression:exit"(node) {
        popFunction();
      },
      ReturnStatement(node) {
        if (functionStack.length > 1 && isJSX(node.argument) && !isJSXComponentElement(node.argument) && !isSingularJSXReturn(node.argument)) {
          context.report({
            node,
            message: "Nested function returning non-component, non-singular JSX detected. Extract it into its own component."
          });
        }
      },
      "ArrowFunctionExpression > JSXElement"(node) {
        if (functionStack.length > 1 && !isJSXComponentElement(node) && !isSingularJSXReturn(node)) {
          context.report({
            node,
            message: "Nested arrow function returning non-component, non-singular JSX detected. Extract it into its own component."
          });
        }
      },
      "ArrowFunctionExpression > JSXFragment"(node) {
        if (functionStack.length > 1 && !isSingularJSXReturn(node)) {
          context.report({
            node,
            message: "Nested arrow function returning a non-singular JSX fragment detected. Extract it into its own component."
          });
        }
      }
    };
  }
};

// src/rules/explicit-object-types.js
var explicit_object_types_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit type annotations for object literals and arrays of object literals",
      recommended: false
    },
    schema: []
  },
  create(context) {
    function isObjectLiteral(node) {
      return node && node.type === "ObjectExpression";
    }
    return {
      VariableDeclarator(node) {
        if (!node.init)
          return;
        if (node.id && node.id.typeAnnotation)
          return;
        if (isObjectLiteral(node.init)) {
          context.report({
            node: node.id,
            message: "Object literal must have an explicit type annotation."
          });
          return;
        }
        if (node.init.type === "ArrayExpression") {
          const hasObjectLiteral = node.init.elements.some((element) => element && isObjectLiteral(element));
          if (hasObjectLiteral) {
            context.report({
              node: node.id,
              message: "Array of object literals must have an explicit type annotation."
            });
          }
        }
      }
    };
  }
};

// src/rules/sort-keys-fixable.js
var sort_keys_fixable_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "enforce sorted keys in object literals with auto-fix (limited to simple cases, preserving comments)",
      recommended: false
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          order: {
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
  create(context) {
    const sourceCode = context.getSourceCode();
    const options = context.options[0] || {};
    const order = options.order || "asc";
    const caseSensitive = options.caseSensitive !== undefined ? options.caseSensitive : false;
    const natural = options.natural !== undefined ? options.natural : false;
    const minKeys = options.minKeys !== undefined ? options.minKeys : 2;
    const variablesBeforeFunctions = options.variablesBeforeFunctions !== undefined ? options.variablesBeforeFunctions : false;
    function compareKeys(a, b) {
      let keyA = a;
      let keyB = b;
      if (!caseSensitive) {
        keyA = keyA.toLowerCase();
        keyB = keyB.toLowerCase();
      }
      if (natural) {
        return keyA.localeCompare(keyB, undefined, { numeric: true });
      }
      return keyA.localeCompare(keyB);
    }
    function isFunctionProperty(prop) {
      return prop.value && (prop.value.type === "FunctionExpression" || prop.value.type === "ArrowFunctionExpression" || prop.method === true);
    }
    function buildSortedText(fixableProps) {
      const sorted = fixableProps.slice().sort((a, b) => {
        if (variablesBeforeFunctions) {
          const aIsFunc = isFunctionProperty(a);
          const bIsFunc = isFunctionProperty(b);
          if (aIsFunc !== bIsFunc) {
            return aIsFunc ? 1 : -1;
          }
        }
        const keyA = a.key.type === "Identifier" ? a.key.name : String(a.key.value);
        const keyB = b.key.type === "Identifier" ? b.key.name : String(b.key.value);
        let res = compareKeys(keyA, keyB);
        if (order === "desc") {
          res = -res;
        }
        return res;
      });
      return sorted.map((prop) => {
        const leadingComments = sourceCode.getCommentsBefore(prop) || [];
        const trailingComments = sourceCode.getCommentsAfter(prop) || [];
        const leadingText = leadingComments.length > 0 ? leadingComments.map((comment) => sourceCode.getText(comment)).join(`
`) + `
` : "";
        const trailingText = trailingComments.length > 0 ? `
` + trailingComments.map((comment) => sourceCode.getText(comment)).join(`
`) : "";
        return leadingText + sourceCode.getText(prop) + trailingText;
      }).join(", ");
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
            keyName = String(prop.key.value);
          } else {
            autoFixable = false;
          }
          if (prop.value) {
            if (prop.value.type === "FunctionExpression" || prop.value.type === "ArrowFunctionExpression" || prop.method === true) {
              isFunc = true;
            }
          }
        } else {
          autoFixable = false;
        }
        return { keyName, node: prop, isFunction: isFunc };
      });
      let fixProvided = false;
      for (let i = 1;i < keys.length; i++) {
        const prev = keys[i - 1];
        const curr = keys[i];
        if (prev.keyName === null || curr.keyName === null) {
          continue;
        }
        if (variablesBeforeFunctions) {
          if (prev.isFunction && !curr.isFunction) {
            context.report({
              node: curr.node.key,
              messageId: "unsorted",
              fix: !fixProvided && autoFixable ? (fixer) => {
                const fixableProps = node.properties.filter((prop) => prop.type === "Property" && !prop.computed && (prop.key.type === "Identifier" || prop.key.type === "Literal"));
                if (fixableProps.length < minKeys) {
                  return null;
                }
                const sortedText = buildSortedText(fixableProps);
                const firstProp = fixableProps[0];
                const lastProp = fixableProps[fixableProps.length - 1];
                return fixer.replaceTextRange([
                  firstProp.range[0],
                  lastProp.range[1]
                ], sortedText);
              } : null
            });
            fixProvided = true;
            continue;
          } else if (prev.isFunction === curr.isFunction) {
            if (compareKeys(prev.keyName, curr.keyName) > 0) {
              context.report({
                node: curr.node.key,
                messageId: "unsorted",
                fix: !fixProvided && autoFixable ? (fixer) => {
                  const fixableProps = node.properties.filter((prop) => prop.type === "Property" && !prop.computed && (prop.key.type === "Identifier" || prop.key.type === "Literal"));
                  if (fixableProps.length < minKeys) {
                    return null;
                  }
                  const sortedText = buildSortedText(fixableProps);
                  const firstProp = fixableProps[0];
                  const lastProp = fixableProps[fixableProps.length - 1];
                  return fixer.replaceTextRange([
                    firstProp.range[0],
                    lastProp.range[1]
                  ], sortedText);
                } : null
              });
              fixProvided = true;
            }
          }
        } else {
          if (compareKeys(prev.keyName, curr.keyName) > 0) {
            context.report({
              node: curr.node.key,
              messageId: "unsorted",
              fix: !fixProvided && autoFixable ? (fixer) => {
                const fixableProps = node.properties.filter((prop) => prop.type === "Property" && !prop.computed && (prop.key.type === "Identifier" || prop.key.type === "Literal"));
                if (fixableProps.length < minKeys) {
                  return null;
                }
                const sortedText = buildSortedText(fixableProps);
                const firstProp = fixableProps[0];
                const lastProp = fixableProps[fixableProps.length - 1];
                return fixer.replaceTextRange([
                  firstProp.range[0],
                  lastProp.range[1]
                ], sortedText);
              } : null
            });
            fixProvided = true;
          }
        }
      }
    }
    return {
      ObjectExpression: checkObjectExpression
    };
  }
};

// src/rules/no-transition-cssproperties.js
var no_transition_cssproperties_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring.",
      recommended: false
    },
    schema: [],
    messages: {
      forbiddenTransition: "Objects typed as CSSProperties must not include a 'transition' property as it conflicts with react-spring."
    }
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier" || !node.id.typeAnnotation) {
          return;
        }
        let isStyleType = false;
        const typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        if (typeAnnotation && typeAnnotation.type === "TSTypeReference") {
          const { typeName } = typeAnnotation;
          if (typeName.type === "Identifier" && typeName.name === "CSSProperties") {
            isStyleType = true;
          } else if (typeName.type === "TSQualifiedName" && typeName.right && typeName.right.name === "CSSProperties") {
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
        if (node.init && node.init.type === "ObjectExpression") {
          node.init.properties.forEach((prop) => {
            if (prop.type !== "Property") {
              return;
            }
            if (prop.computed) {
              return;
            }
            let keyName = null;
            if (prop.key.type === "Identifier") {
              keyName = prop.key.name;
            } else if (prop.key.type === "Literal") {
              keyName = String(prop.key.value);
            }
            if (keyName === "transition") {
              context.report({
                node: prop,
                messageId: "forbiddenTransition"
              });
            }
          });
        }
      }
    };
  }
};

// src/rules/no-explicit-return-types.js
var no_explicit_return_types_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow explicit return type annotations on functions, except when using type predicates for type guards or inline object literal returns (e.g., style objects).",
      recommended: false
    },
    schema: [],
    messages: {
      noExplicitReturnType: "Explicit return types are disallowed; rely on TypeScript's inference instead."
    }
  },
  create(context) {
    return {
      "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
        if (node.returnType) {
          const typeAnnotation = node.returnType.typeAnnotation;
          if (typeAnnotation && typeAnnotation.type === "TSTypePredicate") {
            return;
          }
          if (node.type === "ArrowFunctionExpression" && node.expression && node.body && node.body.type === "ObjectExpression") {
            return;
          }
          if (node.body && node.body.type === "BlockStatement") {
            const returns = node.body.body.filter((stmt) => stmt.type === "ReturnStatement");
            if (returns.length === 1 && returns[0].argument && returns[0].argument.type === "ObjectExpression") {
              return;
            }
          }
          context.report({
            node: node.returnType,
            messageId: "noExplicitReturnType"
          });
        }
      }
    };
  }
};

// src/rules/max-jsx-nesting.js
var max_jsx_nesting_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when JSX elements are nested too deeply, suggesting refactoring into a separate component.",
      recommended: false
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
  create(context) {
    const maxAllowed = context.options[0];
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

// src/rules/seperate-style-files.js
var seperate_style_files_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when a component file (.jsx or .tsx) contains a style object typed as CSSProperties. " + "Style objects should be moved to their own file under the style folder.",
      recommended: false
    },
    schema: [],
    messages: {
      moveToFile: 'Style object "{{name}}" is typed as {{typeName}}. Move it to its own file under the style folder.'
    }
  },
  create(context) {
    const filename = context.getFilename();
    if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) {
      return {};
    }
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier")
          return;
        const identifier = node.id;
        if (!identifier.typeAnnotation)
          return;
        const typeNode = identifier.typeAnnotation.typeAnnotation;
        if (typeNode.type === "TSTypeReference" && typeNode.typeName) {
          let typeName = null;
          if (typeNode.typeName.type === "Identifier") {
            typeName = typeNode.typeName.name;
          } else if (typeNode.typeName.type === "TSQualifiedName") {
            typeName = typeNode.typeName.right.name;
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
      }
    };
  }
};

// src/rules/no-unnecessary-key.js
var no_unnecessary_key_default = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce that the key prop is only used on components rendered as part of a mapping",
      recommended: false
    },
    schema: [],
    messages: {
      unnecessaryKey: "The key prop should only be used on elements that are directly rendered as part of an array mapping."
    }
  },
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
      return ancestors.some((node) => {
        if (node.type === "CallExpression" && node.callee && node.callee.type === "MemberExpression") {
          const property = node.callee.property;
          return property.type === "Identifier" && property.name === "map" || property.type === "Literal" && property.value === "map";
        }
        return false;
      });
    }
    function isReturnedFromFunction(ancestors) {
      return ancestors.some((node) => node.type === "ReturnStatement");
    }
    function checkJSXOpeningElement(node) {
      const keyAttribute = node.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name && attr.name.name === "key");
      if (!keyAttribute) {
        return;
      }
      const ancestors = typeof context.getAncestors === "function" ? context.getAncestors() : getAncestors(node);
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

// src/rules/sort-exports.js
var sort_exports_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce that top-level export declarations are sorted by exported name and, optionally, that variable exports come before function exports",
      category: "Stylistic Issues",
      recommended: false
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          order: {
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
  create(context) {
    const sourceCode = context.getSourceCode();
    const options = context.options[0] || {};
    const order = options.order || "asc";
    const caseSensitive = options.caseSensitive !== undefined ? options.caseSensitive : false;
    const natural = options.natural !== undefined ? options.natural : false;
    const minKeys = options.minKeys !== undefined ? options.minKeys : 2;
    const variablesBeforeFunctions = options.variablesBeforeFunctions !== undefined ? options.variablesBeforeFunctions : false;
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
      let cmp = natural ? strA.localeCompare(strB, undefined, { numeric: true }) : strA.localeCompare(strB);
      return order === "asc" ? cmp : -cmp;
    }
    function getExportName(node) {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === "VariableDeclaration") {
          if (decl.declarations.length === 1) {
            const id = decl.declarations[0].id;
            if (id.type === "Identifier") {
              return id.name;
            }
          }
        } else if (decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") {
          if (decl.id && decl.id.type === "Identifier") {
            return decl.id.name;
          }
        }
      } else if (node.specifiers && node.specifiers.length === 1) {
        const spec = node.specifiers[0];
        return spec.exported.name || spec.exported.value;
      }
      return null;
    }
    function isFunctionExport(node) {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === "VariableDeclaration") {
          if (decl.declarations.length === 1) {
            const init = decl.declarations[0].init;
            return init && (init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression");
          }
        } else if (decl.type === "FunctionDeclaration") {
          return true;
        }
        return false;
      }
      return false;
    }
    function sortComparator(a, b) {
      const kindA = a.node.exportKind || "value";
      const kindB = b.node.exportKind || "value";
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
    function hasForwardDependency(node, laterNames, visited = new WeakSet) {
      if (!node || typeof node !== "object") {
        return false;
      }
      if (visited.has(node)) {
        return false;
      }
      visited.add(node);
      if (node.type === "Identifier" && laterNames.has(node.name)) {
        return true;
      }
      for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const element of value) {
              if (element && typeof element === "object") {
                if (hasForwardDependency(element, laterNames, visited)) {
                  return true;
                }
              }
            }
          } else if (value && typeof value === "object") {
            if (hasForwardDependency(value, laterNames, visited)) {
              return true;
            }
          }
        }
      }
      return false;
    }
    function processExportBlock(block) {
      if (block.length < minKeys) {
        return;
      }
      const items = block.map((node) => {
        const name = getExportName(node);
        if (name === null) {
          return null;
        }
        return {
          name,
          node,
          isFunction: isFunctionExport(node),
          text: sourceCode.getText(node)
        };
      }).filter(Boolean);
      if (items.length < minKeys) {
        return;
      }
      const sortedItems = items.slice().sort(sortComparator);
      let reportNeeded = false;
      let messageId = "alphabetical";
      for (let i = 1;i < items.length; i++) {
        if (sortComparator(items[i - 1], items[i]) > 0) {
          reportNeeded = true;
          if (variablesBeforeFunctions && items[i - 1].isFunction && !items[i].isFunction) {
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
        const laterNames = new Set(exportNames.slice(i + 1));
        const nodeToCheck = items[i].node.declaration || items[i].node;
        if (hasForwardDependency(nodeToCheck, laterNames)) {
          return;
        }
      }
      const expectedOrder = sortedItems.map((item) => item.name).join(", ");
      context.report({
        node: items[0].node,
        messageId,
        data: {
          expectedOrder
        },
        fix(fixer) {
          const fixableNodes = block.filter((n) => {
            if (n.declaration) {
              if (n.declaration.type === "VariableDeclaration" && n.declaration.declarations.length === 1 && n.declaration.declarations[0].id.type === "Identifier") {
                return true;
              }
              if ((n.declaration.type === "FunctionDeclaration" || n.declaration.type === "ClassDeclaration") && n.declaration.id && n.declaration.id.type === "Identifier") {
                return true;
              }
              return false;
            }
            if (n.specifiers && n.specifiers.length === 1) {
              return true;
            }
            return false;
          });
          if (fixableNodes.length < minKeys) {
            return null;
          }
          const sortedText = sortedItems.map((item) => generateExportText(item.node)).join(`
`);
          const first = block[0].range[0];
          const last = block[block.length - 1].range[1];
          const originalText = sourceCode.getText().slice(first, last);
          if (originalText === sortedText) {
            return null;
          }
          return fixer.replaceTextRange([first, last], sortedText);
        }
      });
    }
    return {
      "Program:exit"(node) {
        const body = node.body;
        let block = [];
        for (let i = 0;i < body.length; i++) {
          const n = body[i];
          if (n.type === "ExportNamedDeclaration" && !n.source && getExportName(n) !== null) {
            block.push(n);
          } else {
            if (block.length) {
              processExportBlock(block);
              block = [];
            }
          }
        }
        if (block.length) {
          processExportBlock(block);
        }
      }
    };
  }
};

// src/rules/localize-react-props.js
var localize_react_props_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow variables that are only passed to a single custom child component. For useState, only report if both the state and its setter are exclusively passed to a single custom child. For general variables, only report if a given child receives exactly one such candidate \u2013 if two or more are passed to the same component type, they\u2019re assumed to be settings that belong on the parent.",
      category: "Best Practices",
      recommended: false
    }
  },
  create(context) {
    const candidateVariables = [];
    function getJSXElementName(jsxElement) {
      if (!jsxElement || !jsxElement.openingElement || !jsxElement.openingElement.name) {
        return "";
      }
      const nameNode = jsxElement.openingElement.name;
      if (nameNode.type === "JSXIdentifier") {
        return nameNode.name;
      }
      if (nameNode.type === "JSXMemberExpression") {
        let current = nameNode;
        while (current.property) {
          current = current.property;
        }
        if (current && current.type === "JSXIdentifier") {
          return current.name;
        }
      }
      return "";
    }
    function isUseStateCall(node) {
      return node && node.type === "CallExpression" && node.callee && (node.callee.type === "Identifier" && node.callee.name === "useState" || node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name === "useState");
    }
    function isHookCall(node) {
      return node && node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && /^use[A-Z]/.test(node.callee.name) && node.callee.name !== "useState";
    }
    function getJSXAncestor(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "JSXElement") {
          return current;
        }
        current = current.parent;
      }
      return null;
    }
    function isContextProviderValueProp(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "JSXAttribute" && current.name && current.name.name === "value") {
          if (current.parent && current.parent.type === "JSXOpeningElement") {
            const nameNode = current.parent.name;
            if (nameNode.type === "JSXIdentifier") {
              const tagName = nameNode.name;
              if (tagName.endsWith("Provider") || tagName.endsWith("Context")) {
                return true;
              }
            } else if (nameNode.type === "JSXMemberExpression") {
              let currentMember = nameNode;
              while (currentMember.type === "JSXMemberExpression") {
                currentMember = currentMember.property;
              }
              if (currentMember && currentMember.type === "JSXIdentifier") {
                if (currentMember.name.endsWith("Provider") || currentMember.name.endsWith("Context")) {
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
      if (nameNode.type === "JSXIdentifier") {
        return /^[A-Z]/.test(nameNode.name);
      }
      if (nameNode.type === "JSXMemberExpression") {
        let current = nameNode;
        while (current.object) {
          current = current.object;
        }
        return current.type === "JSXIdentifier" && /^[A-Z]/.test(current.name);
      }
      return false;
    }
    function getComponentFunction(node) {
      let current = node;
      while (current) {
        if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression" || current.type === "ArrowFunctionExpression") {
          return current;
        }
        current = current.parent;
      }
      return null;
    }
    function analyzeVariableUsage(declarationNode, varName, componentFunction) {
      const usage = { jsxUsageSet: new Set, hasOutsideUsage: false };
      const sourceCode = context.getSourceCode();
      const visitorKeys = sourceCode.visitorKeys || {};
      const stack = [];
      if (componentFunction.body.type === "BlockStatement") {
        for (let i = 0;i < componentFunction.body.body.length; i++) {
          stack.push(componentFunction.body.body[i]);
        }
      } else {
        stack.push(componentFunction.body);
      }
      while (stack.length) {
        const currentNode = stack.pop();
        if (!currentNode)
          continue;
        if (currentNode.type === "Identifier" && currentNode.name === varName && currentNode !== declarationNode) {
          if (isContextProviderValueProp(currentNode)) {} else {
            const jsxAncestor = getJSXAncestor(currentNode);
            if (jsxAncestor && isCustomJSXElement(jsxAncestor)) {
              usage.jsxUsageSet.add(jsxAncestor);
            } else {
              usage.hasOutsideUsage = true;
            }
          }
        }
        const isFunction = currentNode.type === "FunctionDeclaration" || currentNode.type === "FunctionExpression" || currentNode.type === "ArrowFunctionExpression";
        if (isFunction && currentNode !== componentFunction) {
          let shadows = false;
          if (currentNode.params && currentNode.params.length > 0) {
            for (let i = 0;i < currentNode.params.length; i++) {
              const param = currentNode.params[i];
              if (param.type === "Identifier" && param.name === varName) {
                shadows = true;
                break;
              }
            }
          }
          if (shadows)
            continue;
        }
        const keys = visitorKeys[currentNode.type] || [];
        for (let i = 0;i < keys.length; i++) {
          const key = keys[i];
          const child = currentNode[key];
          if (Array.isArray(child)) {
            for (let j = 0;j < child.length; j++) {
              if (child[j] && typeof child[j].type === "string") {
                stack.push(child[j]);
              }
            }
          } else if (child && typeof child.type === "string") {
            stack.push(child);
          }
        }
      }
      return usage;
    }
    const componentHookVars = new WeakMap;
    function getHookSet(componentFunction) {
      if (!componentHookVars.has(componentFunction)) {
        componentHookVars.set(componentFunction, new Set);
      }
      return componentHookVars.get(componentFunction);
    }
    function hasHookDependency(node, hookSet) {
      const sourceCode = context.getSourceCode();
      const visitorKeys = sourceCode.visitorKeys || {};
      const stack = [node];
      while (stack.length) {
        const currentNode = stack.pop();
        if (!currentNode)
          continue;
        if (currentNode.type === "Identifier") {
          if (hookSet.has(currentNode.name)) {
            return true;
          }
        }
        const keys = visitorKeys[currentNode.type] || [];
        for (let i = 0;i < keys.length; i++) {
          const key = keys[i];
          const child = currentNode[key];
          if (Array.isArray(child)) {
            for (let j = 0;j < child.length; j++) {
              if (child[j] && typeof child[j].type === "string") {
                stack.push(child[j]);
              }
            }
          } else if (child && typeof child.type === "string") {
            stack.push(child);
          }
        }
      }
      return false;
    }
    return {
      VariableDeclarator(node) {
        const componentFunction = getComponentFunction(node);
        if (!componentFunction || !componentFunction.body)
          return;
        if (node.init && node.id && node.id.type === "Identifier" && node.init.type === "CallExpression" && isHookCall(node.init)) {
          const hookSet = getHookSet(componentFunction);
          hookSet.add(node.id.name);
        }
        if (node.init && isUseStateCall(node.init) && node.id.type === "ArrayPattern" && node.id.elements.length >= 2) {
          const stateElem = node.id.elements[0];
          const setterElem = node.id.elements[1];
          if (!stateElem || stateElem.type !== "Identifier" || !setterElem || setterElem.type !== "Identifier") {
            return;
          }
          const stateVarName = stateElem.name;
          const setterVarName = setterElem.name;
          const stateUsage = analyzeVariableUsage(stateElem, stateVarName, componentFunction);
          const setterUsage = analyzeVariableUsage(setterElem, setterVarName, componentFunction);
          const stateExclusivelySingleJSX = !stateUsage.hasOutsideUsage && stateUsage.jsxUsageSet.size === 1;
          const setterExclusivelySingleJSX = !setterUsage.hasOutsideUsage && setterUsage.jsxUsageSet.size === 1;
          if (stateExclusivelySingleJSX && setterExclusivelySingleJSX && [...stateUsage.jsxUsageSet][0] === [...setterUsage.jsxUsageSet][0]) {
            context.report({
              node,
              message: "State variable '{{stateVarName}}' and its setter '{{setterVarName}}' are only passed to a single custom child component. Consider moving the state into that component.",
              data: { stateVarName, setterVarName }
            });
          }
        } else if (node.id && node.id.type === "Identifier") {
          const varName = node.id.name;
          if (node.init) {
            const hookSet = getHookSet(componentFunction);
            if (hasHookDependency(node.init, hookSet)) {
              return;
            }
          }
          const usage = analyzeVariableUsage(node.id, varName, componentFunction);
          if (!usage.hasOutsideUsage && usage.jsxUsageSet.size === 1) {
            const target = [...usage.jsxUsageSet][0];
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
        candidateVariables.forEach((candidate) => {
          const key = candidate.componentName;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key).push(candidate);
        });
        groups.forEach((candidates) => {
          if (candidates.length === 1) {
            const candidate = candidates[0];
            context.report({
              node: candidate.node,
              message: "Variable '{{varName}}' is only passed to a single custom child component. Consider moving it to that component.",
              data: { varName: candidate.varName }
            });
          }
        });
      }
    };
  }
};

// src/rules/no-or-none-component.js
var no_or_none_component_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer using logical && operator over ternary with null/undefined for conditional JSX rendering.",
      recommended: false
    },
    messages: {
      useLogicalAnd: "Prefer using the logical '&&' operator instead of a ternary with null/undefined for conditional rendering."
    }
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        const alternate = node.alternate;
        if (alternate && (alternate.type === "Literal" && alternate.value === null || alternate.type === "Identifier" && alternate.name === "undefined")) {
          if (node.parent && node.parent.type === "JSXExpressionContainer") {
            const containerParent = node.parent.parent;
            if (containerParent && containerParent.type !== "JSXAttribute") {
              context.report({
                node,
                messageId: "useLogicalAnd"
              });
            }
          }
        }
      }
    };
  }
};

// src/rules/no-button-navigation.js
var no_button_navigation_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce using anchor tags for navigation instead of buttons whose onClick handlers change the path. Allow only query/hash updates via window.location.search or history.replaceState(window.location.pathname + \u2026).",
      category: "Best Practices",
      recommended: false
    },
    schema: []
  },
  create(context) {
    function urlUsesAllowedLocation(argNode) {
      let allowed = false;
      const visited = new WeakSet;
      function check(n) {
        if (allowed || !n || typeof n !== "object" || visited.has(n))
          return;
        visited.add(n);
        if (n.type === "MemberExpression" && n.object.type === "MemberExpression" && n.object.object.type === "Identifier" && n.object.object.name === "window" && n.object.property.type === "Identifier" && n.object.property.name === "location" && n.property.type === "Identifier" && (n.property.name === "pathname" || n.property.name === "search" || n.property.name === "hash")) {
          allowed = true;
          return;
        }
        for (const key of Object.keys(n)) {
          if (key === "parent")
            continue;
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach((c) => check(c));
          } else {
            check(child);
          }
        }
      }
      check(argNode);
      return allowed;
    }
    function containsWindowNavigation(node) {
      let reason = null;
      const visited = new WeakSet;
      let sawReplaceCall = false;
      let sawAllowedLocationRead = false;
      function inspect(n, parent) {
        if (reason || !n || typeof n !== "object" || visited.has(n))
          return;
        visited.add(n);
        if (n.type === "MemberExpression" && n.object.type === "Identifier" && n.object.name === "window" && n.property.type === "Identifier" && n.property.name === "open") {
          reason = "window.open";
          return;
        }
        if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression") {
          const left = n.left;
          if (left.object.type === "Identifier" && left.object.name === "window" && left.property.type === "Identifier" && left.property.name === "location") {
            reason = "assignment to window.location";
            return;
          }
          if (left.object.type === "MemberExpression" && left.object.object.type === "Identifier" && left.object.object.name === "window" && left.object.property.type === "Identifier" && left.object.property.name === "location") {
            reason = "assignment to window.location sub-property";
            return;
          }
        }
        if (n.type === "MemberExpression" && n.object.type === "MemberExpression" && n.object.object.type === "Identifier" && n.object.object.name === "window" && n.object.property.type === "Identifier" && n.object.property.name === "location" && n.property.type === "Identifier" && n.property.name === "replace") {
          if (parent && parent.type === "CallExpression") {
            reason = "window.location.replace";
            return;
          }
        }
        if (n.type === "MemberExpression" && n.object.type === "MemberExpression" && n.object.object.type === "Identifier" && n.object.object.name === "window" && n.object.property.type === "Identifier" && n.object.property.name === "history" && n.property.type === "Identifier" && (n.property.name === "pushState" || n.property.name === "replaceState")) {
          sawReplaceCall = true;
        }
        if (n.type === "MemberExpression" && n.object.type === "MemberExpression" && n.object.object.type === "Identifier" && n.object.object.name === "window" && n.object.property.type === "Identifier" && n.object.property.name === "location" && n.property.type === "Identifier" && (n.property.name === "search" || n.property.name === "pathname" || n.property.name === "hash")) {
          sawAllowedLocationRead = true;
        }
        for (const key of Object.keys(n)) {
          if (key === "parent" || reason)
            continue;
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach((c) => inspect(c, n));
          } else {
            inspect(child, n);
          }
          if (reason)
            return;
        }
      }
      inspect(node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" ? node.body : node, null);
      if (reason) {
        return { shouldReport: true, reason };
      }
      if (sawReplaceCall && !sawAllowedLocationRead) {
        return {
          shouldReport: true,
          reason: "history.replace/pushState without reading window.location"
        };
      }
      return { shouldReport: false, reason: null };
    }
    return {
      JSXElement(node) {
        const { openingElement } = node;
        if (openingElement.name.type === "JSXIdentifier" && openingElement.name.name === "button") {
          for (const attr of openingElement.attributes) {
            if (attr.type === "JSXAttribute" && attr.name.name === "onClick" && attr.value?.type === "JSXExpressionContainer") {
              const expr = attr.value.expression;
              if (expr.type === "ArrowFunctionExpression" || expr.type === "FunctionExpression") {
                const { shouldReport, reason } = containsWindowNavigation(expr);
                if (shouldReport) {
                  context.report({
                    node: attr,
                    message: `Use an anchor tag for navigation instead of a button whose onClick handler changes the path. ` + `Detected: ${reason}. Only query/hash updates (reading window.location.search, .pathname, or .hash) are allowed.`
                  });
                }
              }
            }
          }
        }
      }
    };
  }
};

// src/rules/no-multi-style-objects.js
var no_multi_style_objects_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow grouping CSS style objects in a single export; export each style separately.",
      category: "Best Practices",
      recommended: false
    },
    schema: []
  },
  create(context) {
    function checkObjectExpression(node) {
      if (node.properties && node.properties.length > 0) {
        const cssStyleProperties = node.properties.filter((prop) => {
          if (prop.key) {
            if (prop.key.type === "Identifier") {
              return prop.key.name.endsWith("Style");
            }
            if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
              return prop.key.value.endsWith("Style");
            }
          }
          return false;
        });
        if (cssStyleProperties.length > 1) {
          context.report({
            node,
            message: "Do not group CSS style objects in a single export; export each style separately."
          });
        }
      }
    }
    return {
      ExportDefaultDeclaration(node) {
        if (node.declaration && node.declaration.type === "ObjectExpression") {
          checkObjectExpression(node.declaration);
        }
      },
      ReturnStatement(node) {
        if (node.argument && node.argument.type === "ObjectExpression") {
          checkObjectExpression(node.argument);
        }
      }
    };
  }
};

// src/rules/no-useless-function.js
var no_useless_function_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow functions that have no parameters and just return an object literal; consider exporting the object directly, unless the function is used as a callback (e.g., in react-spring).",
      category: "Best Practices",
      recommended: false
    },
    fixable: null
  },
  create(context) {
    function isCallbackFunction(node) {
      return node.parent && node.parent.type === "CallExpression" && node.parent.arguments.includes(node);
    }
    return {
      ArrowFunctionExpression(node) {
        if (node.params.length === 0 && node.body && node.body.type === "ObjectExpression") {
          if (isCallbackFunction(node)) {
            return;
          }
          context.report({
            node,
            message: "This function has no parameters and simply returns an object. Consider exporting the object directly instead of wrapping it in a function."
          });
        }
      }
    };
  }
};

// src/rules/min-var-length.js
var min_var_length_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow variable names shorter than the configured minimum length unless an outer variable with a longer name starting with the same characters exists. You can exempt specific variable names using the allowedVars option.",
      recommended: false
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
  create(context) {
    const sourceCode = context.getSourceCode();
    const options = context.options[0] || {};
    const minLength = typeof options.minLength === "number" ? options.minLength : 1;
    const allowedVars = options.allowedVars || [];
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
      return sourceCode.scopeManager.acquire(node) || sourceCode.scopeManager.globalScope;
    }
    function getVariablesInNearestBlock(node) {
      let current = node.parent;
      while (current && current.type !== "BlockStatement") {
        current = current.parent;
      }
      const names = [];
      if (current && Array.isArray(current.body)) {
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
            if (element)
              extractIdentifiersFromPattern(element, identifiers);
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
      let currentScope = getScope(node);
      let outer = currentScope.upper;
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
      if (typeof name === "string" && name.length < minLength) {
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
            if (element)
              checkPattern(element);
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

// src/rules/max-depth-extended.js
var max_depth_extended_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow too many nested blocks except when the block only contains an early exit (return or throw)",
      category: "Best Practices",
      recommended: false
    },
    schema: [
      {
        type: "number"
      }
    ]
  },
  create(context) {
    const maxDepth = typeof context.options[0] === "number" ? context.options[0] : 1;
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
      return node.body.length === 1 && (node.body[0].type === "ReturnStatement" || node.body[0].type === "ThrowStatement");
    }
    function checkDepth(node, depth) {
      if (depth > maxDepth) {
        context.report({
          node,
          message: "Blocks are nested too deeply ({{depth}}). Maximum allowed is {{maxDepth}} or an early exit.",
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
        const parent = ancestors[0];
        if (parent && (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && node === parent.body) {
          return;
        }
        if (isEarlyExitBlock(node)) {
          return;
        }
        if (functionStack.length > 0) {
          functionStack[functionStack.length - 1]++;
          checkDepth(node, functionStack[functionStack.length - 1]);
        }
      },
      "BlockStatement:exit"(node) {
        const ancestors = getAncestors(node);
        const parent = ancestors[0];
        if (parent && (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && node === parent.body) {
          return;
        }
        if (isEarlyExitBlock(node)) {
          return;
        }
        if (functionStack.length > 0) {
          functionStack[functionStack.length - 1]--;
        }
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

// src/rules/spring-naming-convention.js
var spring_naming_convention_default = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce correct naming for useSpring and useSprings hook destructuring",
      category: "Stylistic Issues",
      recommended: false
    },
    schema: []
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.init && node.init.type === "CallExpression" && node.init.callee && node.init.callee.type === "Identifier" && (node.init.callee.name === "useSpring" || node.init.callee.name === "useSprings")) {
          const hookName = node.init.callee.name;
          if (node.id && node.id.type === "ArrayPattern") {
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
                  message: "The first variable from useSpring must end with 'Springs'."
                });
              } else {
                const base = firstName.slice(0, -"Springs".length);
                if (!base) {
                  context.report({
                    node: firstElem,
                    message: "The first variable must have a non-empty name before 'Springs'."
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
                  message: "The first variable from useSprings must end with 'Springs'."
                });
              } else {
                const basePlural = firstName.slice(0, -"Springs".length);
                if (!basePlural) {
                  context.report({
                    node: firstElem,
                    message: "The first variable must have a non-empty name before 'Springs'."
                  });
                  return;
                }
                if (!basePlural.endsWith("s")) {
                  context.report({
                    node: firstElem,
                    message: "The first variable for useSprings should be a plural name (ending with an 's') before 'Springs'."
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

// src/rules/inline-style-limit.js
var inline_style_limit_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow inline style objects with too many keys and encourage extracting them",
      category: "Best Practices",
      recommended: false
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
  create(context) {
    const option = context.options[0];
    const maxKeys = typeof option === "number" ? option : option && option.maxKeys || 3;
    return {
      JSXAttribute(node) {
        if (node.name.name !== "style") {
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

// src/rules/no-inline-prop-types.js
var no_inline_prop_types_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce that component prop types are not defined inline (using an object literal) but rather use a named type or interface.",
      category: "Best Practices",
      recommended: false
    },
    schema: [],
    messages: {
      noInlinePropTypes: "Inline prop type definitions are not allowed. Use a named type alias or interface instead of an inline object type."
    }
  },
  create(context) {
    function checkParameter(param) {
      if (param && param.type === "ObjectPattern" && param.typeAnnotation && param.typeAnnotation.type === "TSTypeAnnotation") {
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
        const firstParam = node.params[0];
        if (firstParam) {
          checkParameter(firstParam);
        }
      }
    };
  }
};

// src/rules/no-unnecessary-div.js
var no_unnecessary_div_default = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag unnecessary <div> wrappers that enclose a single JSX element. Remove the wrapper if it doesn't add semantic or functional value, or replace it with a semantic element if wrapping is needed.",
      category: "Best Practices",
      recommended: false
    }
  },
  create(context) {
    return {
      JSXElement(node) {
        if (node.openingElement.name && node.openingElement.name.name === "div") {
          const meaningfulChildren = node.children.filter((child) => {
            if (child.type === "JSXText") {
              return child.value.trim() !== "";
            }
            return true;
          });
          if (meaningfulChildren.length === 1 && meaningfulChildren[0].type === "JSXElement") {
            context.report({
              node,
              message: "Unnecessary <div> wrapper detected. Remove it if not needed, or replace with a semantic element that reflects its purpose."
            });
          }
        }
      }
    };
  }
};

// src/index.js
var src_default = {
  rules: {
    "no-nested-jsx-return": no_nested_jsx_return_default,
    "explicit-object-types": explicit_object_types_default,
    "sort-keys-fixable": sort_keys_fixable_default,
    "no-transition-cssproperties": no_transition_cssproperties_default,
    "no-explicit-return-type": no_explicit_return_types_default,
    "max-jsxnesting": max_jsx_nesting_default,
    "seperate-style-files": seperate_style_files_default,
    "no-unnecessary-key": no_unnecessary_key_default,
    "sort-exports": sort_exports_default,
    "localize-react-props": localize_react_props_default,
    "no-or-none-component": no_or_none_component_default,
    "no-button-navigation": no_button_navigation_default,
    "no-multi-style-objects": no_multi_style_objects_default,
    "no-useless-function": no_useless_function_default,
    "min-var-length": min_var_length_default,
    "max-depth-extended": max_depth_extended_default,
    "spring-naming-convention": spring_naming_convention_default,
    "inline-style-limit": inline_style_limit_default,
    "no-inline-prop-types": no_inline_prop_types_default,
    "no-unnecessary-div": no_unnecessary_div_default
  }
};
export {
  src_default as default
};
