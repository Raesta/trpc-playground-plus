import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { RouterSchema } from '../types';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { javascript } from "@codemirror/lang-javascript";
import { linter, Diagnostic } from '@codemirror/lint';
import { parseCodeForTrpcCalls } from '../utils/code-parser';
import { validateCodeWithCache } from '../utils/zod-validator';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string) => Promise<void>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    border: '1px solid #333',
    borderRadius: '4px',
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
        let info = `tRPC ${def.type}: ${key}`;

        if (def.type !== 'router' && 'inputSchema' in def && def.inputSchema) {
          const inputType = formatSchemaForInfo(def.inputSchema);
          info += `\nInput: ${inputType}`;
        }

        if (def.type !== 'router' && 'outputSchema' in def && def.outputSchema) {
          const outputType = formatSchemaForInfo(def.outputSchema);
          info += `\nOutput: ${outputType}`;
        }

        return {
          label: key,
          type: def.type === 'router' ? 'class' : def.type === 'query' ? 'function' : 'method',
          apply: `${key}.`,
          info
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
        let info = `tRPC ${def.type}: ${key}`;

        if (def.type !== 'router' && 'inputSchema' in def && def.inputSchema) {
          const inputType = formatSchemaForInfo(def.inputSchema);
          info += `\nInput: ${inputType}`;
        }

        if (def.type !== 'router' && 'outputSchema' in def && def.outputSchema) {
          const outputType = formatSchemaForInfo(def.outputSchema);
          info += `\nOutput: ${outputType}`;
        }

        return {
          label: key,
          type: def.type === 'router' ? 'class' : def.type === 'query' ? 'function' : 'method',
          apply: ['query', 'mutation'].includes(def.type) ? `${key}.${def.type === 'mutation' ? 'mutate' : 'query'}()` : `${key}.`,
          info
        };
      });
    } else if (routerDef) {
      const type = routerDef.type === 'mutation' ? 'mutate' : 'query';
      let info = `Execute this procedure as ${type}`;

      if (routerDef.type !== 'router' && 'inputSchema' in routerDef && routerDef.inputSchema) {
        const inputType = formatSchemaForInfo(routerDef.inputSchema);
        info += `\nInput: ${inputType}`;
      }

      if (routerDef.type !== 'router' && 'outputSchema' in routerDef && routerDef.outputSchema) {
        const outputType = formatSchemaForInfo(routerDef.outputSchema);
        info += `\nOutput: ${outputType}`;
      }

      return [
        {
          label: type,
          type: 'function',
          apply: `${type}()`,
          info
        }
      ];
    }

    return [];
  };

  const createTRPCCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const text = context.state.doc.sliceString(0, context.pos);
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
            button.style.backgroundColor = "#4CAF50";
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
          trpcAutocompleteExtension,
          trpcLinterExtension,
          playButtonExtension
        ]}
        onChange={onChange}
        style={styles.editor}
      />
    </div>
  );
};