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
  [key: string]: {
    type: 'router';
    children?: RouterSchema;
  } | {
    type: 'query' | 'mutation';
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
    inputSchema?: any;
    outputSchema?: any;
    inputZodSchema?: any;
    outputZodSchema?: any;
  }
}

export interface PlaygroundConfig {
  trpcUrl: string;
  endpoints: Array<string>;
  schema: RouterSchema;
}

export interface Tab {
  id: string;
  title: string;
  content: string;
  isActive?: boolean;
}

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}
