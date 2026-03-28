import React, { useRef, useMemo, useCallback } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { getCodeMirrorTheme } from '../editorTheme';
import { autocompletion, CompletionContext, CompletionResult, startCompletion } from '@codemirror/autocomplete';
import { RouterSchema, Variable } from '../types';
import { Decoration, EditorView, WidgetType, GutterMarker, gutter, ViewUpdate } from '@codemirror/view';
import { RangeSet, RangeSetBuilder } from '@codemirror/state';
import { foldGutter } from '@codemirror/language';
import { javascript } from "@codemirror/lang-javascript";
import { linter, Diagnostic } from '@codemirror/lint';
import { parseCodeForTrpcCalls } from '../utils/code-parser';
import { validateCodeWithCache, resolveVariableType } from '../utils/zod-validator';
import { createEditorTheme } from '../editorTheme';
import { EditorToolbar } from './EditorToolbar';
import { useTheme } from '../ThemeContext';
import { formatKeymap, formatDocument } from '../utils/formatter';
import { ThemeConfig } from '../theme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string) => Promise<void>;
  variables?: Variable[];
  onTabDrawerClick?: () => void;
  fontSize?: number;
}

// --- DOM helper functions (accept theme as parameter) ---

const FIXED_TYPE_COLORS: Record<string, string> = {
  query: '#3b82f6',
  mutation: '#f59e0b',
  router: '#a855f7',
  subscription: '#10b981',
};

function createBadge(text: string, color: string, theme: ThemeConfig): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.textContent = text;
  Object.assign(badge.style, {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: theme.radius.sm,
    fontSize: theme.font.size.xs,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: color,
    marginLeft: '6px',
    verticalAlign: 'middle',
  });
  return badge;
}

function createCodeBlock(content: string, theme: ThemeConfig): HTMLElement {
  const pre = document.createElement('pre');
  Object.assign(pre.style, {
    margin: '4px 0 0',
    padding: '6px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg.code,
    border: `1px solid ${theme.colors.border.primary}`,
    fontSize: theme.font.size.sm,
    fontFamily: theme.font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: theme.colors.text.primary,
    lineHeight: '1.4',
  });
  pre.textContent = content;
  return pre;
}

function createProcedureInfoNode(
  name: string,
  type: string,
  theme: ThemeConfig,
  inputSchema?: string,
  outputSchema?: string,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '360px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', marginBottom: '6px' });
  const title = document.createElement('span');
  title.textContent = name;
  Object.assign(title.style, { fontWeight: '700', fontSize: theme.font.size.base, color: theme.colors.text.primary });
  header.appendChild(title);
  header.appendChild(createBadge(type, FIXED_TYPE_COLORS[type] || theme.colors.text.muted, theme));
  container.appendChild(header);

  const addSection = (labelText: string, content: string) => {
    const label = document.createElement('div');
    label.textContent = labelText;
    Object.assign(label.style, {
      fontSize: theme.font.size.xs, fontWeight: '600', color: theme.colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px',
    });
    container.appendChild(label);
    container.appendChild(createCodeBlock(content, theme));
  };

  if (inputSchema) addSection('Input', inputSchema);
  if (outputSchema) addSection('Output', outputSchema);

  return container;
}

function createPropertyInfoNode(
  name: string,
  type: string,
  isRequired: boolean,
  theme: ThemeConfig,
  description?: string,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '300px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '6px' });

  const nameEl = document.createElement('span');
  nameEl.textContent = name;
  Object.assign(nameEl.style, { fontWeight: '700', fontSize: theme.font.size.base, color: theme.colors.text.primary });
  header.appendChild(nameEl);

  const typeEl = document.createElement('span');
  typeEl.textContent = type;
  Object.assign(typeEl.style, { fontSize: theme.font.size.sm, color: theme.colors.accent.info, fontFamily: theme.font.mono });
  header.appendChild(typeEl);

  header.appendChild(createBadge(isRequired ? 'required' : 'optional', isRequired ? theme.colors.accent.danger : theme.colors.text.muted, theme));
  container.appendChild(header);

  if (description) {
    const desc = document.createElement('div');
    desc.textContent = description;
    Object.assign(desc.style, { marginTop: '6px', fontSize: theme.font.size.sm, color: theme.colors.text.secondary });
    container.appendChild(desc);
  }

  return container;
}

function createTrpcInfoNode(theme: ThemeConfig): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '360px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', marginBottom: '6px' });
  const title = document.createElement('span');
  title.textContent = 'trpc';
  Object.assign(title.style, { fontWeight: '700', fontSize: theme.font.size.base, color: theme.colors.text.primary });
  header.appendChild(title);
  header.appendChild(createBadge('client', theme.colors.accent.primary, theme));
  container.appendChild(header);

  const desc = document.createElement('div');
  desc.textContent = 'tRPC client — access your API routes via dot notation.';
  Object.assign(desc.style, { fontSize: theme.font.size.sm, color: theme.colors.text.secondary, marginBottom: '8px' });
  container.appendChild(desc);

  const label = document.createElement('div');
  label.textContent = 'Usage';
  Object.assign(label.style, {
    fontSize: theme.font.size.xs, fontWeight: '600', color: theme.colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  });
  container.appendChild(label);
  container.appendChild(createCodeBlock('trpc.router.procedure.query(input)', theme));

  return container;
}

function createVariableInfoNode(
  name: string,
  type: string,
  value: string,
  theme: ThemeConfig,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '300px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '6px' });

  const nameEl = document.createElement('span');
  nameEl.textContent = name;
  Object.assign(nameEl.style, { fontWeight: '700', fontSize: theme.font.size.base, color: theme.colors.text.primary });
  header.appendChild(nameEl);

  header.appendChild(createBadge('variable', theme.colors.accent.info, theme));
  header.appendChild(createBadge(type, FIXED_TYPE_COLORS[type] || theme.colors.text.muted, theme));
  container.appendChild(header);

  if (value) {
    const label = document.createElement('div');
    label.textContent = 'Value';
    Object.assign(label.style, {
      fontSize: theme.font.size.xs, fontWeight: '600', color: theme.colors.text.secondary,
      textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px',
    });
    container.appendChild(label);
    container.appendChild(createCodeBlock(value, theme));
  }

  return container;
}

// --- Component ---

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, schema, onPlayRequest, variables = [], onTabDrawerClick, fontSize = 15 }) => {
  const theme = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);

  const styles: Record<string, React.CSSProperties> = useMemo(() => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.primary}`,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      height: '100%',
      width: '100%'
    },
    editor: {
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      minHeight: 0,
      flex: 1,
    }
  }), [theme]);

  const autocompleteTheme = useMemo(() => EditorView.theme({
    '.cm-tooltip.cm-tooltip-autocomplete': {
      border: `1px solid ${theme.colors.border.primary} !important`,
      borderRadius: `${theme.radius.md} !important`,
      backgroundColor: `${theme.colors.bg.secondary} !important`,
      boxShadow: `${theme.shadow.lg} !important`,
    },
    '.cm-tooltip-autocomplete ul': {
      fontFamily: `${theme.font.mono} !important`,
      fontSize: `${theme.font.size.base} !important`,
    },
    '.cm-tooltip-autocomplete ul li': {
      padding: '4px 10px !important',
      borderBottom: '1px solid #ffffff08',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: `${theme.colors.bg.active} !important`,
      color: `${theme.colors.text.primary} !important`,
    },
    '.cm-completionIcon': {
      width: '1.2em !important',
      textAlign: 'center',
    },
    '.cm-completionIcon-class::after': { content: '"◆"', color: theme.colors.accent.router },
    '.cm-completionIcon-function::after': { content: '"ƒ"', color: theme.colors.accent.query },
    '.cm-completionIcon-method::after': { content: '"ƒ"', color: theme.colors.accent.mutation },
    '.cm-completionIcon-property::after': { content: '"●"', color: theme.colors.accent.danger },
    '.cm-completionIcon-variable::after': { content: '"○"', color: theme.colors.text.muted },
    '.cm-completionIcon-text::after': { content: '"T"', color: theme.colors.text.secondary },
    '.cm-tooltip.cm-completionInfo': {
      backgroundColor: `${theme.colors.bg.secondary} !important`,
      border: `1px solid ${theme.colors.border.primary} !important`,
      borderRadius: `${theme.radius.md} !important`,
      boxShadow: `${theme.shadow.lg} !important`,
      padding: '0 !important',
      marginLeft: '4px !important',
    },
    '.cm-completionInfo.cm-completionInfo-left': {
      marginRight: '4px !important',
    },
  }), [theme]);

  const createTrpcLinter = React.useCallback((schema: RouterSchema, variables: Variable[]) => {
    const variableTypes = new Map(
      variables
        .filter(v => v.enabled && v.key.trim())
        .map(v => [v.key.trim(), resolveVariableType(v.value)] as const)
    );

    return linter((view) => {
      const code = view.state.doc.toString();
      const parseResult = parseCodeForTrpcCalls(code);
      const diagnostics: Diagnostic[] = [];

      for (const parseError of parseResult.errors) {
        diagnostics.push({
          from: parseError.position.start,
          to: parseError.position.end,
          severity: 'error',
          message: parseError.message,
        });
      }

      if (parseResult.calls.length > 0) {
        const validationResult = validateCodeWithCache(code, parseResult.calls, schema, variableTypes);

        for (const error of validationResult.errors) {
          diagnostics.push({
            from: error.position.start,
            to: error.position.end,
            severity: 'error',
            message: error.message,
            source: 'tRPC Type Check',
          });
        }

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

  const trpcLinterExtension = React.useMemo(() => createTrpcLinter(schema, variables), [schema, variables, createTrpcLinter]);

  const formatSchemaForInfo = (schema: any): string => {
    if (!schema) return '';
    try {
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
          boost: def.type === 'router' ? 80 : def.type === 'query' ? 60 : 40,
          apply,
          info: () => createProcedureInfoNode(key, def.type, theme, inputType, outputType),
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
          boost: def.type === 'router' ? 80 : def.type === 'query' ? 60 : 40,
          apply,
          info: () => createProcedureInfoNode(key, def.type, theme, inputType, outputType),
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
          boost: 60,
          apply: (view, _completion, from, to) => {
            const text = `${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 }
            });
          },
          info: () => createProcedureInfoNode(methodName, routerDef.type, theme, inputType, outputType),
        }
      ];
    }

    return [];
  };

  const createTRPCCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    const text = context.state.doc.sliceString(0, context.pos);

    const regex = /trpc((?:\.\w+)+)\.(query|mutate)\(/g;
    let procedureMatch;
    let lastMatch = null;

    while ((procedureMatch = regex.exec(text)) !== null) {
      lastMatch = procedureMatch;
    }

    if (lastMatch) {
      const procedureStart = lastMatch.index! + lastMatch[0].length;
      const afterProcedure = text.substring(procedureStart);

      let parenCount = 1;
      let inString = false;
      let stringChar = '';

      for (let i = 0; i < afterProcedure.length; i++) {
        const char = afterProcedure[i];

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
          if (parenCount === 0) break;
        }
      }

      if (parenCount > 0) {
        const pathStr = lastMatch[1];
        const path = pathStr.substring(1).split('.');

        let currentLevel = schema;
        for (let i = 0; i < path.length - 1; i++) {
          const segment = path[i];
          if (currentLevel[segment]?.type === 'router' && currentLevel[segment].children) {
            currentLevel = currentLevel[segment].children!;
          } else {
            break;
          }
        }

        const lastSegment = path[path.length - 1];
        const procedureDef = currentLevel[lastSegment];

        if (procedureDef && procedureDef.type !== 'router' && 'inputSchema' in procedureDef && procedureDef.inputSchema) {
          const inputSchema = procedureDef.inputSchema;

          const argVariableOptions = variables
            .filter(v => v.key.trim() && v.enabled && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v.key.trim()))
            .map(v => ({
              label: v.key.trim(),
              type: 'constant',
              info: () => createVariableInfoNode(v.key.trim(), v.type || resolveVariableType(v.value), v.value || '(empty)', theme),
              boost: 0,
            }));

          if (inputSchema.type === 'object' && inputSchema.properties) {
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
                    boost: 20,
                    apply: (view, _completion, from, to) => {
                      const text = '{}';
                      view.dispatch({
                        changes: { from, to, insert: text },
                        selection: { anchor: from + 1 }
                      });
                    },
                    info: 'Add argument object'
                  },
                  ...argVariableOptions,
                ]
              };
            } else {
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
                const tokens = objectContent.split(',');
                for (const token of tokens) {
                  const trimmed = token.trim();
                  if (/^\w+$/.test(trimmed)) {
                    usedKeys.add(trimmed);
                  }
                }
              }

              const needsComma = (() => {
                const beforeCursor = afterProcedure.trimEnd();
                if (beforeCursor.length === 0) return false;
                const lastChar = beforeCursor[beforeCursor.length - 1];
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
                    type: isRequired ? 'property' : 'text',
                    boost: 20,
                    apply,
                    info: () => createPropertyInfoNode(key, type, isRequired, theme, propSchema.description),
                  };
                });

              return {
                from,
                options: [...options, ...argVariableOptions],
              };
            }
          } else if (argVariableOptions.length > 0) {
            const from = word ? word.from : context.pos;
            return { from, options: argVariableOptions };
          }
        }
      }
    }

    if (!word || (word.from === word.to && !context.explicit)) return null;

    const trpcPathMatch = text.match(/trpc((?:\.\w+)*)(\.)?$/);

    if (trpcPathMatch) {
      const pathStr = trpcPathMatch[1] || '';
      const endsWithDot = !!trpcPathMatch[2];
      const segments = pathStr ? pathStr.substring(1).split('.') : [];

      const path = endsWithDot
        ? (segments.length > 0 ? segments : [''])
        : (segments.length > 1 ? segments.slice(0, -1) : ['']);

      const options = getCompletionsFromPath(path);

      return {
        from: word.from,
        options
      };
    }

    const variableOptions = (variables ?? [])
      .filter(v => v.key.trim() && v.enabled && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v.key.trim()))
      .map(v => ({
        label: v.key.trim(),
        type: 'constant',
        info: () => createVariableInfoNode(v.key.trim(), v.type || resolveVariableType(v.value), v.value || '(empty)', theme),
      }));

    if (word && word.from < word.to) {
      return {
        from: word.from,
        options: [
          { label: 'trpc', type: 'text', boost: 100, apply: 'trpc.', info: () => createTrpcInfoNode(theme) },
          ...variableOptions,
        ]
      };
    }

    if (context.explicit) {
      return {
        from: word ? word.from : context.pos,
        options: [
          { label: 'trpc', type: 'text', boost: 100, apply: 'trpc.', info: () => createTrpcInfoNode(theme) },
          ...variableOptions,
        ]
      };
    }

    return null;
  };

  const trpcAutocompleteExtension = React.useMemo(() => autocompletion({
    override: [createTRPCCompletions],
    activateOnTyping: true,
    defaultKeymap: true,
    maxRenderedOptions: 100,
  }), [schema, variables, theme]);

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

  let cachedText = '';
  let cachedCallLines = new Map<number, string>();

  function getCallLines(text: string, doc: any): Map<number, string> {
    if (text === cachedText) return cachedCallLines;
    cachedText = text;
    cachedCallLines = new Map();
    const calls = findTrpcCalls(text);
    for (const call of calls) {
      const line = doc.lineAt(call.start);
      if (!cachedCallLines.has(line.from)) {
        cachedCallLines.set(line.from, call.code);
      }
    }
    return cachedCallLines;
  }

  class LineNumberMarker extends GutterMarker {
    constructor(private num: string) { super(); }
    toDOM() {
      const span = document.createElement("span");
      span.textContent = this.num;
      return span;
    }
  }

  class PlayButtonMarker extends GutterMarker {
    constructor(private callCode: string) { super(); }
    toDOM() {
      const btn = document.createElement("button");
      btn.innerHTML = "▶";
      btn.style.cssText = `
        font-size:9px; border:none; background:${theme.colors.accent.play};
        color:white; border-radius:50%; width:16px; height:16px;
        cursor:pointer; padding:0; display:inline-flex; align-items:center;
        justify-content:center; line-height:1;
      `;
      btn.title = "Execute this call";
      const code = this.callCode;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onPlayRequest) onPlayRequest(code);
      };
      return btn;
    }
  }

  const playLineNumbersExtension = gutter({
    class: "cm-lineNumbers",
    lineMarker(view, line) {
      const text = view.state.doc.toString();
      const callLines = getCallLines(text, view.state.doc);
      const lineNum = view.state.doc.lineAt(line.from).number;
      if (callLines.has(line.from)) {
        return new PlayButtonMarker(callLines.get(line.from)!);
      }
      return new LineNumberMarker(String(lineNum));
    },
    lineMarkerChange(update: ViewUpdate) {
      return update.docChanged;
    },
    initialSpacer(view) {
      const lines = view.state.doc.lines;
      return new LineNumberMarker(String(lines));
    },
  });

  const handleFormat = useCallback(() => {
    const view = editorRef.current?.view;
    if (view) formatDocument(view);
  }, []);

  return (
    <div style={styles.container}>
      <EditorToolbar editorRef={editorRef} onTabDrawerClick={onTabDrawerClick} onFormat={handleFormat} />
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={cmTheme}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
        extensions={[
          formatKeymap,
          javascript({ typescript: true }),
          editorTheme,
          playLineNumbersExtension,
          foldGutter(),
          trpcAutocompleteExtension,
          autocompleteTheme,
          dotTriggerExtension,
          trpcLinterExtension,
        ]}
        onChange={onChange}
        style={styles.editor}
      />
    </div>
  );
};
