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

export type ThemeMode = 'dark' | 'light';

export interface PlaygroundSettings {
  splitPosition: number;
  fontSize: number;
  theme: ThemeMode;
  requestTimeout: number;
}
