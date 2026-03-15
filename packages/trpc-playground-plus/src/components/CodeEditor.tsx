import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { autocompletion, CompletionContext, CompletionResult, startCompletion } from '@codemirror/autocomplete';
import { RouterSchema } from '../types';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { javascript } from "@codemirror/lang-javascript";
import { linter, Diagnostic } from '@codemirror/lint';
import { parseCodeForTrpcCalls } from '../utils/code-parser';
import { validateCodeWithCache } from '../utils/zod-validator';
import { editorThemeExtension } from '../editorTheme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string) => Promise<void>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    border: `1px solid ${t.colors.border.primary}`,
    borderRadius: t.radius.md,
    overflow: 'hidden',
    height: '100%',
    width: '100%'
  },
  editor: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  }
}

import { theme as t } from '../theme';

const TYPE_COLORS: Record<string, string> = {
  query: t.colors.accent.query,
  mutation: t.colors.accent.mutation,
  router: t.colors.accent.router,
  subscription: t.colors.accent.subscription,
};

function createBadge(text: string, color: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.textContent = text;
  Object.assign(badge.style, {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: t.radius.sm,
    fontSize: t.font.size.xs,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: color,
    marginLeft: '6px',
    verticalAlign: 'middle',
  });
  return badge;
}

function createCodeBlock(content: string): HTMLElement {
  const pre = document.createElement('pre');
  Object.assign(pre.style, {
    margin: '4px 0 0',
    padding: '6px 8px',
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.bg.code,
    border: `1px solid ${t.colors.border.primary}`,
    fontSize: t.font.size.sm,
    fontFamily: t.font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: t.colors.text.primary,
    lineHeight: '1.4',
  });
  pre.textContent = content;
  return pre;
}

function createProcedureInfoNode(
  name: string,
  type: string,
  inputSchema?: string,
  outputSchema?: string,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, {
    padding: '8px 10px',
    maxWidth: '360px',
    lineHeight: '1.5',
  });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', marginBottom: '6px' });
  const title = document.createElement('span');
  title.textContent = name;
  Object.assign(title.style, { fontWeight: '700', fontSize: t.font.size.base, color: t.colors.text.primary });
  header.appendChild(title);
  header.appendChild(createBadge(type, TYPE_COLORS[type] || t.colors.text.muted));
  container.appendChild(header);

  const addSection = (labelText: string, content: string) => {
    const label = document.createElement('div');
    label.textContent = labelText;
    Object.assign(label.style, {
      fontSize: t.font.size.xs, fontWeight: '600', color: t.colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px',
    });
    container.appendChild(label);
    container.appendChild(createCodeBlock(content));
  };

  if (inputSchema) addSection('Input', inputSchema);
  if (outputSchema) addSection('Output', outputSchema);

  return container;
}

function createPropertyInfoNode(
  name: string,
  type: string,
  isRequired: boolean,
  description?: string,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '300px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '6px' });

  const nameEl = document.createElement('span');
  nameEl.textContent = name;
  Object.assign(nameEl.style, { fontWeight: '700', fontSize: t.font.size.base, color: t.colors.text.primary });
  header.appendChild(nameEl);

  const typeEl = document.createElement('span');
  typeEl.textContent = type;
  Object.assign(typeEl.style, { fontSize: t.font.size.sm, color: t.colors.accent.info, fontFamily: t.font.mono });
  header.appendChild(typeEl);

  header.appendChild(createBadge(isRequired ? 'required' : 'optional', isRequired ? t.colors.accent.danger : t.colors.text.muted));
  container.appendChild(header);

  if (description) {
    const desc = document.createElement('div');
    desc.textContent = description;
    Object.assign(desc.style, { marginTop: '6px', fontSize: t.font.size.sm, color: t.colors.text.secondary });
    container.appendChild(desc);
  }

  return container;
}

const autocompleteTheme = EditorView.theme({
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: `1px solid ${t.colors.border.primary} !important`,
    borderRadius: `${t.radius.md} !important`,
    backgroundColor: `${t.colors.bg.secondary} !important`,
    boxShadow: `${t.shadow.lg} !important`,
  },
  '.cm-tooltip-autocomplete ul': {
    fontFamily: `${t.font.mono} !important`,
    fontSize: `${t.font.size.base} !important`,
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 10px !important',
    borderBottom: '1px solid #ffffff08',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: `${t.colors.bg.active} !important`,
    color: `${t.colors.text.primary} !important`,
  },
  '.cm-completionIcon': {
    width: '1.2em !important',
    textAlign: 'center',
  },
  '.cm-completionIcon-class::after': { content: '"◆"', color: t.colors.accent.router },
  '.cm-completionIcon-function::after': { content: '"ƒ"', color: t.colors.accent.query },
  '.cm-completionIcon-method::after': { content: '"ƒ"', color: t.colors.accent.mutation },
  '.cm-completionIcon-property::after': { content: '"●"', color: t.colors.accent.danger },
  '.cm-completionIcon-variable::after': { content: '"○"', color: t.colors.text.muted },
  '.cm-completionIcon-text::after': { content: '"T"', color: t.colors.text.secondary },
  '.cm-tooltip.cm-completionInfo': {
    backgroundColor: `${t.colors.bg.secondary} !important`,
    border: `1px solid ${t.colors.border.primary} !important`,
    borderRadius: `${t.radius.md} !important`,
    boxShadow: `${t.shadow.lg} !important`,
    padding: '0 !important',
    marginLeft: '4px !important',
  },
  '.cm-completionInfo.cm-completionInfo-left': {
    marginRight: '4px !important',
  },
});

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, schema, onPlayRequest }) => {

  const createTrpcLinter = React.useCallback((schema: RouterSchema) => {
    return linter((view) => {
      const code = view.state.doc.toString();
      const parseResult = parseCodeForTrpcCalls(code);
      const diagnostics: Diagnostic[] = [];

      // Add parsing errors
      for (const parseError of parseResult.errors) {
        diagnostics.push({
          from: parseError.position.start,
          to: parseError.position.end,
          severity: 'error',
          message: parseError.message,
        });
      }

      // Validate tRPC calls
      if (parseResult.calls.length > 0) {
        const validationResult = validateCodeWithCache(code, parseResult.calls, schema);

        // Add validation errors
        for (const error of validationResult.errors) {
          diagnostics.push({
            from: error.position.start,
            to: error.position.end,
            severity: 'error',
            message: error.message,
            source: 'tRPC Type Check',
          });
        }

        // Add warnings
        for (const warning of validationResult.warnings) {
          diagnostics.push({
            from: warning.position.start,
            to: warning.position.end,
            severity: 'warning',
            message: warning.message,
            source: 'tRPC Type Check',
          });
        }
      }

      return diagnostics;
    });
  }, []);

  const trpcLinterExtension = React.useMemo(() => createTrpcLinter(schema), [schema, createTrpcLinter]);
  const formatSchemaForInfo = (schema: any): string => {
    if (!schema) return '';

    try {
      // If it's a JSON schema, extract type information
      if (schema.type === 'object' && schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([key, prop]: [string, any]) => {
            const type = prop.type || 'unknown';
            const required = schema.required?.includes(key) ? '' : '?';
            return `${key}${required}: ${type}`;
          })
          .join(', ');
        return `{ ${props} }`;
      } else if (schema.type) {
        return schema.type;
      }
    } catch (error) {
      console.warn('Error formatting schema:', error);
    }

    return 'any';
  };

  const getCompletionsFromPath = (path: string[]): CompletionResult['options'] => {
    if (path.length === 0 || path[0] === '') {
      return Object.entries(schema).map(([key, def]) => {
        const inputType = def.type !== 'router' && 'inputSchema' in def && def.inputSchema
          ? formatSchemaForInfo(def.inputSchema) : undefined;
        const outputType = def.type !== 'router' && 'outputSchema' in def && def.outputSchema
          ? formatSchemaForInfo(def.outputSchema) : undefined;

        let apply: string | ((view: any, completion: any, from: number, to: number) => void);

        if (['query', 'mutation'].includes(def.type)) {
          const methodName = def.type === 'mutation' ? 'mutate' : 'query';
          apply = (view, _completion, from, to) => {
            const text = `${key}.${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 }
            });
          };
        } else {
          apply = `${key}.`;
        }

        return {
          label: key,
          type: def.type === 'router' ? 'class' : def.type === 'query' ? 'function' : 'method',
          apply,
          info: () => createProcedureInfoNode(key, def.type, inputType, outputType),
        };
      });
    }

    let currentLevel = schema;
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (currentLevel[segment] && currentLevel[segment].type === 'router' && currentLevel[segment].children) {
        currentLevel = currentLevel[segment].children!;
      } else {
        return [];
      }
    }

    const lastSegment = path[path.length - 1];
    const routerDef = currentLevel[lastSegment];

    if (routerDef && routerDef.type === 'router' && routerDef.children) {
      return Object.entries(routerDef.children).map(([key, def]) => {
        const inputType = def.type !== 'router' && 'inputSchema' in def && def.inputSchema
          ? formatSchemaForInfo(def.inputSchema) : undefined;
        const outputType = def.type !== 'router' && 'outputSchema' in def && def.outputSchema
          ? formatSchemaForInfo(def.outputSchema) : undefined;

        let apply: string | ((view: any, completion: any, from: number, to: number) => void);
        if (['query', 'mutation'].includes(def.type)) {
          const methodName = def.type === 'mutation' ? 'mutate' : 'query';
          apply = (view, _completion, from, to) => {
            const text = `${key}.${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 }
            });
          };
        } else {
          apply = `${key}.`;
        }

        return {
          label: key,
          type: def.type === 'router' ? 'class' : def.type === 'query' ? 'function' : 'method',
          apply,
          info: () => createProcedureInfoNode(key, def.type, inputType, outputType),
        };
      });
    } else if (routerDef) {
      const methodName = routerDef.type === 'mutation' ? 'mutate' : 'query';
      const inputType = routerDef.type !== 'router' && 'inputSchema' in routerDef && routerDef.inputSchema
        ? formatSchemaForInfo(routerDef.inputSchema) : undefined;
      const outputType = routerDef.type !== 'router' && 'outputSchema' in routerDef && routerDef.outputSchema
        ? formatSchemaForInfo(routerDef.outputSchema) : undefined;

      return [
        {
          label: methodName,
          type: 'function',
          apply: (view, _completion, from, to) => {
            const text = `${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 }
            });
          },
          info: () => createProcedureInfoNode(methodName, routerDef.type, inputType, outputType),
        }
      ];
    }

    return [];
  };

  const createTRPCCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    const text = context.state.doc.sliceString(0, context.pos);

    // Find the LAST match of query( or mutate( before the cursor
    const regex = /trpc((?:\.\w+)+)\.(query|mutate)\(/g;
    let procedureMatch;
    let lastMatch = null;

    while ((procedureMatch = regex.exec(text)) !== null) {
      lastMatch = procedureMatch;
    }

    if (lastMatch) {
      const procedureStart = lastMatch.index! + lastMatch[0].length;
      const afterProcedure = text.substring(procedureStart);

      // Count parentheses taking into account new Date() and other functions
      let parenCount = 1; // We start after the ( of query( or mutate(
      let inString = false;
      let stringChar = '';

      for (let i = 0; i < afterProcedure.length; i++) {
        const char = afterProcedure[i];

        // Handle character strings
        if ((char === '"' || char === "'") && (i === 0 || afterProcedure[i - 1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
          continue;
        }

        if (inString) continue;

        if (char === '(') parenCount++;
        else if (char === ')') {
          parenCount--;
          if (parenCount === 0) break; // query/mutate parentheses closed
        }
      }

      // If we are still within the query/mutate parentheses
      if (parenCount > 0) {
        const pathStr = lastMatch[1];
        const path = pathStr.substring(1).split('.');

        // Get the inputSchema of the procedure
        let currentLevel = schema;
        for (let i = 0; i < path.length - 1; i++) {
          const segment = path[i];
          if (currentLevel[segment]?.type === 'router' && currentLevel[segment].children) {
            currentLevel = currentLevel[segment].children!;
          } else {
            break; // Exit if we don't find the segment
          }
        }

        const lastSegment = path[path.length - 1];
        const procedureDef = currentLevel[lastSegment];

        if (procedureDef && procedureDef.type !== 'router' && 'inputSchema' in procedureDef && procedureDef.inputSchema) {
          const inputSchema = procedureDef.inputSchema;

          // If the schema is an object, suggest the properties
          if (inputSchema.type === 'object' && inputSchema.properties) {
            // Use the full document to detect braces and used keys,
            // not just the text before cursor
            const fullText = context.state.doc.toString();
            const fullAfterProcedure = fullText.substring(procedureStart);
            const hasOpenBrace = fullAfterProcedure.includes('{');

            const from = word ? word.from : context.pos;

            if (!hasOpenBrace) {
              return {
                from,
                options: [
                  {
                    label: '{}',
                    type: 'text',
                    apply: (view, _completion, from, to) => {
                      const text = '{}';
                      view.dispatch({
                        changes: { from, to, insert: text },
                        selection: { anchor: from + 1 }
                      });
                    },
                    info: 'Add argument object'
                  }
                ]
              };
            } else {
              // Scan used keys in the full argument object, not just before cursor
              const usedKeys = new Set<string>();
              const braceStart = fullAfterProcedure.indexOf('{');
              if (braceStart !== -1) {
                let depth = 1;
                let scanPos = braceStart + 1;
                while (scanPos < fullAfterProcedure.length && depth > 0) {
                  if (fullAfterProcedure[scanPos] === '{') depth++;
                  else if (fullAfterProcedure[scanPos] === '}') depth--;
                  scanPos++;
                }
                const objectContent = fullAfterProcedure.substring(braceStart + 1, scanPos - 1);
                const propertyRegex = /(\w+)\s*:/g;
                let propMatch;
                while ((propMatch = propertyRegex.exec(objectContent)) !== null) {
                  usedKeys.add(propMatch[1]);
                }
              }

              // Detect if we need to add a comma before the new property
              const needsComma = (() => {
                // Look for non-whitespace text before the cursor (in afterProcedure)
                const beforeCursor = afterProcedure.trimEnd();
                if (beforeCursor.length === 0) return false;

                const lastChar = beforeCursor[beforeCursor.length - 1];
                // If the last character is not a comma, { or [, we need a comma
                return lastChar !== ',' && lastChar !== '{' && lastChar !== '[';
              })();

              const required = inputSchema.required || [];
              const options = Object.entries(inputSchema.properties)
                .filter(([key]) => !usedKeys.has(key))
                .map(([key, propSchema]: [string, any]) => {
                  const isRequired = required.includes(key);
                  const type = propSchema.type || 'unknown';

                  let apply = key;
                  if (type === 'object') apply = `${key}: {}`;
                  else if (type === 'array') apply = `${key}: []`;
                  else if (type === 'string') apply = `${key}: ""`;
                  else if (type === 'number' || type === 'integer') apply = `${key}: 0`;
                  else if (type === 'boolean') apply = `${key}: false`;
                  else apply = `${key}: `;

                  if (needsComma) {
                    apply = ', ' + apply;
                  }

                  return {
                    label: key,
                    type: isRequired ? 'property' : 'variable',
                    apply,
                    info: () => createPropertyInfoNode(key, type, isRequired, propSchema.description),
                  };
                });

              return {
                from,
                options
              };
            }
          }
        }
      }
    }

    if (!word || (word.from === word.to && !context.explicit)) return null;

    const trpcPathMatch = text.match(/trpc((?:\.\w+)*)?\.?$/);

    if (trpcPathMatch) {
      const pathStr = trpcPathMatch[1] || '';
      const path = pathStr ? pathStr.substring(1).split('.') : [''];

      const options = getCompletionsFromPath(path);

      return {
        from: word.from,
        options
      };
    }

    if (text.startsWith('trpc') || context.explicit) {
      return {
        from: word.from,
        options: [
          { label: 'trpc', type: 'text', apply: 'trpc.', info: 'Access tRPC properties' }
        ]
      };
    }

    return null;
  };

  const trpcAutocompleteExtension = autocompletion({
    override: [createTRPCCompletions],
    activateOnTyping: true,
    defaultKeymap: true,
    maxRenderedOptions: 100,
  });

  const dotTriggerExtension = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    for (const tr of update.transactions) {
      let hasDot = false;
      tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
        if (inserted.toString().endsWith('.')) hasDot = true;
      });
      if (hasDot) {
        setTimeout(() => startCompletion(update.view), 0);
        return;
      }
    }
  });

  const findTrpcCalls = (text: string): { start: number, end: number, code: string }[] => {
    const calls: { start: number, end: number, code: string }[] = [];
    const regex = /trpc\.\w+(?:\.\w+)*\.(query|mutate)\(/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      let start = match.index;
      let pos = start + match[0].length;
      let openParens = 1;

      const lineStart = text.lastIndexOf('\n', start) + 1;
      const linePrefix = text.substring(lineStart, start).trim();

      if (linePrefix === '') {
        while (pos < text.length && openParens > 0) {
          if (text[pos] === '(') openParens++;
          else if (text[pos] === ')') openParens--;
          pos++;
        }

        if (openParens === 0) {
          calls.push({
            start,
            end: pos,
            code: text.substring(start, pos)
          });
        }
      }
    }

    return calls;
  };

  const playButtonExtension = EditorView.decorations.compute(["doc"], state => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = state.doc.toString();
    const calls = findTrpcCalls(text);

    for (const call of calls) {
      const line = state.doc.lineAt(call.start);
      const widget = Decoration.widget({
        widget: new class extends WidgetType {
          toDOM() {
            const button = document.createElement("button");
            button.innerHTML = "▶";
            button.className = "play-button";
            button.style.fontSize = "10px";
            button.style.border = "none";
            button.style.backgroundColor = t.colors.accent.play;
            button.style.color = "white";
            button.style.borderRadius = "50%";
            button.style.width = "18px";
            button.style.height = "18px";
            button.style.cursor = "pointer";
            button.style.marginRight = "4px";
            button.style.padding = "0px";
            button.title = "Execute this call";

            button.onclick = () => {
              if (onPlayRequest) {
                onPlayRequest(call.code);
              }
            };

            return button;
          }
        },
        side: -1
      });

      builder.add(line.from, line.from, widget);
    }

    return builder.finish();
  });

  return (
    <div style={styles.container}>
      <CodeMirror
        value={value}
        theme={vscodeDark}
        extensions={[
          javascript({ typescript: true }),
          editorThemeExtension,
          trpcAutocompleteExtension,
          autocompleteTheme,
          dotTriggerExtension,
          trpcLinterExtension,
          playButtonExtension
        ]}
        onChange={onChange}
        style={styles.editor}
      />
    </div>
  );
};