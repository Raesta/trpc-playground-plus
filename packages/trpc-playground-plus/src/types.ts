export interface RouterProcedure {
  type: 'query' | 'mutation' | 'subscription';
}

export interface RouterDef {
  procedures: Record<string, RouterProcedure>;
  record?: Record<string, RouterLike>;
}

export interface RouterLike {
  _def: RouterDef;
}

export interface RouterSchema {
  [key: string]:
    | {
        type: 'router';
        children?: RouterSchema;
      }
    | {
        type: 'query' | 'mutation';
        inputs?: Record<string, string>;
        outputs?: Record<string, string>;
        inputSchema?: any;
        outputSchema?: any;
        inputZodSchema?: any;
        outputZodSchema?: any;
      };
}

export interface PlaygroundConfig {
  trpcUrl: string;
  endpoints: Array<string>;
  schema: RouterSchema;
  projectKey?: string;
}

export interface Tab {
  id: string;
  title: string;
  content: string;
  isActive?: boolean;
  variables: Variable[];
  headers: Header[];
}

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export const Scope = {
  GLOBAL: 'global',
  LOCAL: 'local',
  ENV: 'env',
} as const;
export type Scope = (typeof Scope)[keyof typeof Scope];

export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'json';

export interface Variable {
  key: string;
  value: string;
  type: VariableType;
  enabled: boolean;
  scope?: Scope;
}

export interface CallInfo {
  procedure: string;
  method: 'query' | 'mutation';
  durationMs: number;
  status: 'ok' | 'error';
}

/** A recorded request in the history journal (extends the inline CallInfo with I/O). */
export interface HistoryEntry extends CallInfo {
  id: string;
  /** Unix ms of execution. */
  timestamp: number;
  /** The executed tRPC call source (the input). */
  code: string;
  /** The JSON-stringified response (or error text) shown in the viewer (the output). */
  response: string;
}

export type ThemeMode = 'dark' | 'light';

/** User-configurable keyboard shortcuts (CodeMirror key syntax, e.g. "Mod-Enter"). */
export interface KeyBindings {
  /** Run the tRPC call at the cursor. */
  run: string;
  /** Open the search panel (in the request editor). */
  search: string;
}

export interface PlaygroundSettings {
  splitPosition: number;
  fontSize: number;
  theme: ThemeMode;
  requestTimeout: number;
  keybindings: KeyBindings;
  /** Maximum number of requests kept in the history journal. */
  historySize: number;
}
