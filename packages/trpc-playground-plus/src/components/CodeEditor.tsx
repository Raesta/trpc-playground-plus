import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
} from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { foldGutter } from '@codemirror/language';
import { type Diagnostic, linter } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, GutterMarker, gutter, type ViewUpdate } from '@codemirror/view';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { createEditorTheme, getCodeMirrorTheme } from '../editorTheme';
import { useTheme } from '../ThemeContext';
import type { ThemeConfig } from '../theme';
import { type RouterSchema, Scope, type Variable } from '../types';
import { parseCodeForTrpcCalls } from '../utils/code-parser';
import { formatDocument, formatKeymap } from '../utils/formatter';
import { resolveVariableType, validateCodeWithCache } from '../utils/zod-validator';
import { EditorToolbar } from './EditorToolbar';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string, range?: { from: number; to: number }) => Promise<void>;
  executingRange?: { from: number; to: number } | null;
  variables?: Variable[];
  onTabDrawerClick?: () => void;
  tabDrawerErrors?: string[];
  fontSize?: number;
}

const setExecutingRangeEffect = StateEffect.define<{ from: number; to: number } | null>();

const executingRangeField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setExecutingRangeEffect)) return effect.value;
    }
    return value;
  },
});

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
      fontSize: theme.font.size.xs,
      fontWeight: '600',
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '8px',
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
  Object.assign(typeEl.style, {
    fontSize: theme.font.size.sm,
    color: theme.colors.accent.info,
    fontFamily: theme.font.mono,
  });
  header.appendChild(typeEl);

  header.appendChild(
    createBadge(
      isRequired ? 'required' : 'optional',
      isRequired ? theme.colors.accent.danger : theme.colors.text.muted,
      theme,
    ),
  );
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
    fontSize: theme.font.size.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
  scope?: Scope,
): HTMLElement {
  const container = document.createElement('div');
  Object.assign(container.style, { padding: '8px 10px', maxWidth: '300px', lineHeight: '1.5' });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '6px' });

  const nameEl = document.createElement('span');
  nameEl.textContent = name;
  Object.assign(nameEl.style, { fontWeight: '700', fontSize: theme.font.size.base, color: theme.colors.text.primary });
  header.appendChild(nameEl);

  const scopeLabel = scope === Scope.ENV ? Scope.ENV : scope === Scope.LOCAL ? Scope.LOCAL : Scope.GLOBAL;
  const scopeColor =
    scope === Scope.ENV
      ? theme.colors.accent.subscription
      : scope === Scope.LOCAL
        ? theme.colors.accent.mutation
        : theme.colors.accent.query;
  header.appendChild(createBadge(scopeLabel, scopeColor, theme));
  header.appendChild(createBadge(type, FIXED_TYPE_COLORS[type] || theme.colors.text.muted, theme));
  container.appendChild(header);

  if (value) {
    const label = document.createElement('div');
    label.textContent = 'Value';
    Object.assign(label.style, {
      fontSize: theme.font.size.xs,
      fontWeight: '600',
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '8px',
    });
    container.appendChild(label);
    container.appendChild(createCodeBlock(value, theme));
  }

  return container;
}

// --- Component ---

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  schema,
  onPlayRequest,
  executingRange,
  variables = [],
  onTabDrawerClick,
  tabDrawerErrors,
  fontSize = 15,
}) => {
  const theme = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    view.dispatch({ effects: setExecutingRangeEffect.of(executingRange ?? null) });
  }, [executingRange]);
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);

  const styles: Record<string, React.CSSProperties> = useMemo(
    () => ({
      container: {
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        height: '100%',
        width: '100%',
      },
      editor: {
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        minHeight: 0,
        flex: 1,
      },
    }),
    [theme],
  );

  const autocompleteTheme = useMemo(
    () =>
      EditorView.theme({
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
          padding: '4px 2px 4px 4px !important',
          borderBottom: '1px solid #ffffff08',
        },
        '.cm-tooltip-autocomplete ul li[aria-selected]': {
          backgroundColor: `${theme.colors.bg.active} !important`,
          color: `${theme.colors.text.primary} !important`,
        },
        '.cm-completionIcon': {
          width: '18px !important',
          height: '16px !important',
          display: 'inline-block !important',
          verticalAlign: 'middle',
          backgroundSize: '14px 14px',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          padding: '0 !important',
          margin: '0 4px 0 0 !important',
          marginLeft: '0 !important',
          paddingLeft: '0 !important',
        },
        '.cm-completionIcon::after': { content: '"" !important' },
        '.cm-completionIcon-class': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.router}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='18' cy='18' r='3'/><circle cx='6' cy='6' r='3'/><path d='M6 21V9a9 9 0 0 0 9 9'/></svg>`)}")`,
        },
        '.cm-completionIcon-function': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.query}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='22 12 18 12'/><polyline points='6 12 2 12'/><circle cx='12' cy='12' r='6'/><line x1='12' y1='6' x2='12' y2='18'/></svg>`)}")`,
        },
        '.cm-completionIcon-method': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.mutation}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='22 12 18 12'/><polyline points='6 12 2 12'/><circle cx='9' cy='12' r='5'/><circle cx='15' cy='12' r='5'/></svg>`)}")`,
        },
        '.cm-completionIcon-property': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.danger}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='4 7 4 4 20 4 20 7'/><line x1='9' y1='20' x2='15' y2='20'/><line x1='12' y1='4' x2='12' y2='20'/></svg>`)}")`,
        },
        '.cm-completionIcon-variable-global': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.query}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>`)}")`,
        },
        '.cm-completionIcon-variable-local': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.mutation}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>`)}")`,
        },
        '.cm-completionIcon-variable-env': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.accent.subscription}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>`)}")`,
        },
        '.cm-completionIcon-text': {
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${theme.colors.text.secondary}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M7 7h10'/><path d='M12 7v10'/><path d='M9 17h6'/></svg>`)}")`,
        },
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
      }),
    [theme],
  );

  const createTrpcLinter = React.useCallback((schema: RouterSchema, variables: Variable[]) => {
    const variableTypes = new Map(
      variables
        .filter((value) => value.enabled && value.key.trim())
        .map((value) => [value.key.trim(), resolveVariableType(value.value)] as const),
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

  const trpcLinterExtension = React.useMemo(
    () => createTrpcLinter(schema, variables),
    [schema, variables, createTrpcLinter],
  );

  const formatSchemaType = (schema: any): string => {
    if (!schema) return 'unknown';
    if (schema.const !== undefined) return JSON.stringify(schema.const);
    if (Array.isArray(schema.enum)) return schema.enum.map((value: any) => JSON.stringify(value)).join(' | ');
    if (Array.isArray(schema.anyOf)) return schema.anyOf.map((value: any) => `| ${formatSchemaType(value)}`).join('\n');
    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([key, prop]: [string, any]) => {
          const required = schema.required?.includes(key) ? '' : '?';
          return `${key}${required}: ${formatSchemaType(prop)}`;
        })
        .join(', ');
      return `{ ${props} }`;
    }
    if (schema.type === 'array' && schema.items) return `${formatSchemaType(schema.items)}[]`;
    return schema.type || 'unknown';
  };

  const formatSchemaForInfo = (schema: any): string => {
    if (!schema) return '';
    try {
      if (schema.type === 'object' && schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([key, prop]: [string, any]) => {
            const type = formatSchemaType(prop);
            const required = schema.required?.includes(key) ? '' : '?';
            return `${key}${required}: ${type}`;
          })
          .join(', ');
        return `{ ${props} }`;
      } else if (schema.type || schema.enum || schema.const !== undefined || schema.anyOf) {
        return formatSchemaType(schema);
      }
    } catch (error) {
      console.warn('Error formatting schema:', error);
    }
    return 'any';
  };

  // Returns the literal value of a schema when it represents a single literal (const or single-value enum).
  const singleLiteral = (prop: any): any => {
    if (!prop) return undefined;
    if (prop.const !== undefined) return prop.const;
    if (Array.isArray(prop.enum) && prop.enum.length === 1) return prop.enum[0];
    return undefined;
  };

  // Finds the discriminant key of a union: a property that holds a single literal in every member.
  const findDiscriminantKey = (members: any[]): string | null => {
    const keys = members[0]?.properties ? Object.keys(members[0].properties) : [];
    for (const key of keys) {
      if (members.every((m) => singleLiteral(m.properties?.[key]) !== undefined)) return key;
    }
    return null;
  };

  // Merges union object members into a single object schema: properties are unioned, differing
  // literals on the same key collapse into an enum, and required keeps only keys required everywhere.
  const mergeObjectSchemas = (members: any[]): any => {
    const properties: Record<string, any> = {};
    const requiredCounts: Record<string, number> = {};
    for (const member of members) {
      for (const [key, value] of Object.entries<any>(member.properties)) {
        const existing = properties[key];
        if (!existing) {
          properties[key] = value;
        } else {
          const existingLiterals = existing.const !== undefined ? [existing.const] : existing.enum;
          const valueLiterals = value.const !== undefined ? [value.const] : value.enum;
          if (Array.isArray(existingLiterals) && Array.isArray(valueLiterals)) {
            properties[key] = { enum: Array.from(new Set([...existingLiterals, ...valueLiterals])) };
          }
        }
        if ((member.required || []).includes(key)) requiredCounts[key] = (requiredCounts[key] || 0) + 1;
      }
    }
    const required = Object.keys(requiredCounts).filter((key) => requiredCounts[key] === members.length);
    return { type: 'object', properties, required };
  };

  // Resolves the effective object schema to drive input-field completion. Plain objects pass through;
  // unions (anyOf) narrow to the member matching the already-typed discriminant, else merge all members.
  const resolveInputObjectSchema = (inputSchema: any, typedObjectContent: string): any => {
    if (!inputSchema) return null;
    if (inputSchema.type === 'object' && inputSchema.properties) return inputSchema;
    if (Array.isArray(inputSchema.anyOf)) {
      const members = inputSchema.anyOf.filter((m: any) => m && m.type === 'object' && m.properties);
      if (members.length === 0) return null;
      const discriminant = findDiscriminantKey(members);
      if (discriminant) {
        // Discriminant already chosen: narrow to the matching variant so only its fields are offered.
        if (typedObjectContent) {
          const match = typedObjectContent.match(new RegExp(`${discriminant}\\s*:\\s*["']([^"']+)["']`));
          if (match) {
            const chosen = members.find((m: any) => String(singleLiteral(m.properties[discriminant])) === match[1]);
            if (chosen) return chosen;
          }
        }
        // Not chosen yet: only offer the discriminant, with every variant's literal as a value option.
        const literals = Array.from(new Set(members.map((m: any) => singleLiteral(m.properties[discriminant]))));
        return {
          type: 'object',
          properties: { [discriminant]: { enum: literals } },
          required: [discriminant],
        };
      }
      // Non-discriminated union: fall back to merging all members' properties.
      return mergeObjectSchemas(members);
    }
    return null;
  };

  const getCompletionsFromPath = (path: string[]): CompletionResult['options'] => {
    if (path.length === 0 || path[0] === '') {
      return Object.entries(schema).map(([key, def]) => {
        const inputType =
          def.type !== 'router' && 'inputSchema' in def && def.inputSchema
            ? formatSchemaForInfo(def.inputSchema)
            : undefined;
        const outputType =
          def.type !== 'router' && 'outputSchema' in def && def.outputSchema
            ? formatSchemaForInfo(def.outputSchema)
            : undefined;

        let apply: string | ((view: any, completion: any, from: number, to: number) => void);

        if (['query', 'mutation'].includes(def.type)) {
          const methodName = def.type === 'mutation' ? 'mutate' : 'query';
          apply = (view, _completion, from, to) => {
            const text = `${key}.${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 },
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
        const inputType =
          def.type !== 'router' && 'inputSchema' in def && def.inputSchema
            ? formatSchemaForInfo(def.inputSchema)
            : undefined;
        const outputType =
          def.type !== 'router' && 'outputSchema' in def && def.outputSchema
            ? formatSchemaForInfo(def.outputSchema)
            : undefined;

        let apply: string | ((view: any, completion: any, from: number, to: number) => void);
        if (['query', 'mutation'].includes(def.type)) {
          const methodName = def.type === 'mutation' ? 'mutate' : 'query';
          apply = (view, _completion, from, to) => {
            const text = `${key}.${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 },
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
      const inputType =
        routerDef.type !== 'router' && 'inputSchema' in routerDef && routerDef.inputSchema
          ? formatSchemaForInfo(routerDef.inputSchema)
          : undefined;
      const outputType =
        routerDef.type !== 'router' && 'outputSchema' in routerDef && routerDef.outputSchema
          ? formatSchemaForInfo(routerDef.outputSchema)
          : undefined;

      return [
        {
          label: methodName,
          type: 'function',
          boost: 60,
          apply: (view, _completion, from, to) => {
            const text = `${methodName}()`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length - 1 },
            });
          },
          info: () => createProcedureInfoNode(methodName, routerDef.type, theme, inputType, outputType),
        },
      ];
    }

    return [];
  };

  const createTRPCCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    const text = context.state.doc.sliceString(0, context.pos);

    const regex = /trpc((?:\.\w+)+)\.(query|mutate)\(/g;
    let lastMatch = null;

    for (let procedureMatch = regex.exec(text); procedureMatch !== null; procedureMatch = regex.exec(text)) {
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

        if (
          procedureDef &&
          procedureDef.type !== 'router' &&
          'inputSchema' in procedureDef &&
          procedureDef.inputSchema
        ) {
          const inputSchema = procedureDef.inputSchema;

          const argVariableOptions = variables
            .filter((value) => value.key.trim() && value.enabled && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value.key.trim()))
            .map((value) => ({
              label: value.key.trim(),
              type:
                value.scope === Scope.ENV
                  ? 'variable-env'
                  : value.scope === Scope.LOCAL
                    ? 'variable-local'
                    : 'variable-global',
              info: () =>
                createVariableInfoNode(
                  value.key.trim(),
                  value.type || resolveVariableType(value.value),
                  value.value || '(empty)',
                  theme,
                  value.scope,
                ),
              boost: value.scope === Scope.ENV ? 0 : value.scope === Scope.GLOBAL ? -10 : -20,
            }));

          const fullText = context.state.doc.toString();
          const fullAfterProcedure = fullText.substring(procedureStart);
          const hasOpenBrace = fullAfterProcedure.includes('{');

          // Extract the already-typed argument-object content (used to narrow discriminated unions).
          let typedObjectContent = '';
          {
            const objBraceStart = fullAfterProcedure.indexOf('{');
            if (objBraceStart !== -1) {
              let depth = 1;
              let scanPos = objBraceStart + 1;
              while (scanPos < fullAfterProcedure.length && depth > 0) {
                if (fullAfterProcedure[scanPos] === '{') depth++;
                else if (fullAfterProcedure[scanPos] === '}') depth--;
                scanPos++;
              }
              typedObjectContent = fullAfterProcedure.substring(objBraceStart + 1, scanPos - 1);
            }
          }

          const effectiveSchema = resolveInputObjectSchema(inputSchema, typedObjectContent);

          if (effectiveSchema) {
            // Check if cursor is right after "propertyName: " (enum/const value slot)
            const beforeCursor = text.substring(procedureStart);
            const valueSlotMatch = beforeCursor.match(/(\w+)\s*:\s*(["']?)(\w*)$/);
            if (valueSlotMatch) {
              const propName = valueSlotMatch[1];
              const quote = valueSlotMatch[2];
              const partial = valueSlotMatch[3];
              const propSchema = (effectiveSchema.properties as any)[propName];
              if (propSchema) {
                const values: any[] = [];
                if (propSchema.const !== undefined) values.push(propSchema.const);
                if (Array.isArray(propSchema.enum)) values.push(...propSchema.enum);
                if (values.length > 0) {
                  const from = context.pos - partial.length - quote.length;
                  return {
                    from,
                    options: values.map((v) => ({
                      label: JSON.stringify(v),
                      type: 'constant',
                      boost: 100,
                      apply: JSON.stringify(v),
                    })),
                  };
                }
              }
            }

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
                        selection: { anchor: from + 1 },
                      });
                    },
                    info: 'Add argument object',
                  },
                  ...argVariableOptions,
                ],
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
                for (
                  let propMatch = propertyRegex.exec(objectContent);
                  propMatch !== null;
                  propMatch = propertyRegex.exec(objectContent)
                ) {
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

              const required = effectiveSchema.required || [];
              const options = Object.entries(effectiveSchema.properties)
                .filter(([key]) => !usedKeys.has(key))
                .map(([key, propSchema]: [string, any]) => {
                  const isRequired = required.includes(key);
                  const type = formatSchemaType(propSchema);
                  const rawType = propSchema.type;

                  let apply = key;
                  if (propSchema.const !== undefined) apply = `${key}: ${JSON.stringify(propSchema.const)}`;
                  else if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0)
                    apply = `${key}: ${JSON.stringify(propSchema.enum[0])}`;
                  else if (rawType === 'object') apply = `${key}: {}`;
                  else if (rawType === 'array') apply = `${key}: []`;
                  else if (rawType === 'string') apply = `${key}: ""`;
                  else if (rawType === 'number' || rawType === 'integer') apply = `${key}: 0`;
                  else if (rawType === 'boolean') apply = `${key}: false`;
                  else apply = `${key}: `;

                  if (needsComma) {
                    apply = `, ${apply}`;
                  }

                  return {
                    label: key,
                    type: isRequired ? 'property' : 'text',
                    boost: isRequired ? 30 : 20,
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
        ? segments.length > 0
          ? segments
          : ['']
        : segments.length > 1
          ? segments.slice(0, -1)
          : [''];

      const options = getCompletionsFromPath(path);

      return {
        from: word.from,
        options,
      };
    }

    const variableOptions = (variables ?? [])
      .filter((v) => v.key.trim() && v.enabled && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v.key.trim()))
      .map((v) => ({
        label: v.key.trim(),
        type: v.scope === Scope.ENV ? 'variable-env' : v.scope === Scope.LOCAL ? 'variable-local' : 'variable-global',
        info: () =>
          createVariableInfoNode(
            v.key.trim(),
            v.type || resolveVariableType(v.value),
            v.value || '(empty)',
            theme,
            v.scope,
          ),
        boost: v.scope === Scope.ENV ? 0 : v.scope === Scope.GLOBAL ? -10 : -20,
      }));

    if (word && word.from < word.to) {
      return {
        from: word.from,
        options: [
          { label: 'trpc', type: 'text', boost: 100, apply: 'trpc.', info: () => createTrpcInfoNode(theme) },
          ...variableOptions,
        ],
      };
    }

    if (context.explicit) {
      return {
        from: word ? word.from : context.pos,
        options: [
          { label: 'trpc', type: 'text', boost: 100, apply: 'trpc.', info: () => createTrpcInfoNode(theme) },
          ...variableOptions,
        ],
      };
    }

    return null;
  };

  const trpcAutocompleteExtension = React.useMemo(
    () =>
      autocompletion({
        override: [createTRPCCompletions],
        activateOnTyping: true,
        defaultKeymap: true,
        maxRenderedOptions: 100,
      }),
    [schema, variables, theme],
  );

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

  const findTrpcCalls = (text: string): { start: number; end: number; code: string }[] => {
    const calls: { start: number; end: number; code: string }[] = [];
    const regex = /trpc\.\w+(?:\.\w+)*\.(query|mutate)\(/g;
    for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
      const start = match.index;
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
            code: text.substring(start, pos),
          });
        }
      }
    }

    return calls;
  };

  interface CallLineData {
    code: string;
    from: number;
    to: number;
  }

  let cachedText = '';
  let cachedCallLines = new Map<number, CallLineData>();

  function getCallLines(text: string, doc: any): Map<number, CallLineData> {
    if (text === cachedText) return cachedCallLines;
    cachedText = text;
    cachedCallLines = new Map();
    const calls = findTrpcCalls(text);
    for (const call of calls) {
      const line = doc.lineAt(call.start);
      if (!cachedCallLines.has(line.from)) {
        cachedCallLines.set(line.from, { code: call.code, from: call.start, to: call.end });
      }
    }
    return cachedCallLines;
  }

  class LineNumberMarker extends GutterMarker {
    constructor(private num: string) {
      super();
    }
    toDOM() {
      const span = document.createElement('span');
      span.textContent = this.num;
      return span;
    }
  }

  class PlayButtonMarker extends GutterMarker {
    constructor(private callData: CallLineData) {
      super();
    }
    eq(other: GutterMarker) {
      return other instanceof PlayButtonMarker && other.callData.code === this.callData.code;
    }
    toDOM() {
      const btn = document.createElement('button');
      btn.innerHTML = '▶';
      btn.style.cssText = `
        font-size:9px; border:none; background:${theme.colors.accent.play};
        color:white; border-radius:50%; width:16px; height:16px;
        cursor:pointer; padding:0; display:inline-flex; align-items:center;
        justify-content:center; line-height:1;
      `;
      btn.title = 'Execute this call';
      const data = this.callData;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onPlayRequest) onPlayRequest(data.code, { from: data.from, to: data.to });
      };
      return btn;
    }
  }

  const playLineNumbersExtension = gutter({
    class: 'cm-lineNumbers',
    lineMarker(view, line) {
      const text = view.state.doc.toString();
      const callLines = getCallLines(text, view.state.doc);
      const lineNum = view.state.doc.lineAt(line.from).number;
      if (callLines.has(line.from)) {
        const data = callLines.get(line.from)!;
        return new PlayButtonMarker(data);
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

  const executingHighlightExtension = useMemo(
    () =>
      EditorView.decorations.compute([executingRangeField], (state): DecorationSet => {
        const range = state.field(executingRangeField);
        if (!range || range.from >= range.to) return Decoration.none;
        const decorations = [];
        const startLine = state.doc.lineAt(range.from);
        const endLine = state.doc.lineAt(range.to);
        for (let n = startLine.number; n <= endLine.number; n++) {
          const line = state.doc.line(n);
          decorations.push(Decoration.line({ class: 'cm-executing-line' }).range(line.from));
        }
        return Decoration.set(decorations);
      }),
    [],
  );

  const executingHighlightTheme = useMemo(
    () =>
      EditorView.theme({
        '.cm-executing-line': {
          backgroundColor: `${theme.colors.accent.spinner}22`,
          boxShadow: `inset 3px 0 0 0 ${theme.colors.accent.spinner}`,
        },
      }),
    [theme],
  );

  return (
    <div style={styles.container}>
      <EditorToolbar
        editorRef={editorRef}
        onTabDrawerClick={onTabDrawerClick}
        tabDrawerErrors={tabDrawerErrors}
        onFormat={handleFormat}
      />
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={cmTheme}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
        extensions={[
          formatKeymap,
          javascript({ typescript: true }),
          editorTheme,
          executingRangeField,
          executingHighlightExtension,
          executingHighlightTheme,
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
