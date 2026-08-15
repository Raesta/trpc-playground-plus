import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnyTRPCRouter } from '@trpc/server';
import { z } from 'zod';
import type { RouterSchema } from '../types';

// ---------------------------------------------------------------------------
// Export data schemas (default tabs/headers passed by the host app)
// ---------------------------------------------------------------------------

const TabSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  isActive: z.boolean().default(false),
});

const HeaderSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
});

export const ExportDataSchema = z.object({
  tabs: z.array(TabSchema).optional(),
  headers: z.array(HeaderSchema).optional(),
  createdAt: z.string().optional(),
});
export type ExportData = z.infer<typeof ExportDataSchema>;

// ---------------------------------------------------------------------------
// tRPC router introspection (framework-agnostic)
// ---------------------------------------------------------------------------

type ProcedureWithDef = ((...args: unknown[]) => unknown) & { _def?: { type?: string } };

function hasDef(fn: unknown): fn is ProcedureWithDef {
  return typeof fn === 'function' && '_def' in fn;
}

function extractProcedureSchemas(def: any) {
  try {
    // In tRPC, the input schema can be in def.inputs (array) or def.input (single)
    const inputSchema = def.inputs?.[0] ?? def.input;
    const outputSchema = def.output;

    return {
      inputSchema: inputSchema ? z.toJSONSchema(inputSchema, { unrepresentable: 'any' }) : null,
      outputSchema: outputSchema ? z.toJSONSchema(outputSchema, { unrepresentable: 'any' }) : null,
      inputZodSchema: inputSchema || null,
      outputZodSchema: outputSchema || null,
    };
  } catch (error) {
    console.warn('Error extracting schemas:', error);
    return {
      inputSchema: null,
      outputSchema: null,
      inputZodSchema: null,
      outputZodSchema: null,
    };
  }
}

export function extractRouterStructure(router: AnyTRPCRouter): RouterSchema {
  const structure: RouterSchema = {};

  Object.entries(router).forEach(([key, value]) => {
    if (key === '_def' || key === 'createCaller') return;

    if (hasDef(value) && value._def) {
      const def = value._def;
      const type: 'query' | 'mutation' | 'router' =
        def.type === 'query' ? 'query' : def.type === 'mutation' ? 'mutation' : 'router';

      const schemas = extractProcedureSchemas(def);
      structure[key] = { type, ...schemas };
    } else if (typeof value === 'object' && value !== null) {
      const hasProcedure = Object.values(value).some((v) => hasDef(v) && v._def);

      if (hasProcedure) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (hasDef(subValue) && subValue._def) {
            const def = subValue._def;
            const type: 'query' | 'mutation' | 'router' =
              def.type === 'query' ? 'query' : def.type === 'mutation' ? 'mutation' : 'router';

            const schemas = extractProcedureSchemas(def);
            if (!structure[key]) structure[key] = { type: 'router', children: {} };
            (structure[key] as { type: 'router'; children: RouterSchema }).children[subKey] = { type, ...schemas };
          }
        });
      } else {
        structure[key] = {
          type: 'router',
          children: extractRouterStructure(value as AnyTRPCRouter),
        };
      }
    }
  });

  return structure;
}

export function stripZodSchemasForClient(schema: RouterSchema): RouterSchema {
  const stripped: RouterSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    if (value.type === 'router') {
      stripped[key] = {
        type: 'router',
        children: value.children ? stripZodSchemasForClient(value.children) : undefined,
      };
    } else {
      // Keep only inputSchema and outputSchema (JSON), not the Zod schemas
      const { inputZodSchema, outputZodSchema, ...rest } = value;
      stripped[key] = rest;
    }
  }

  return stripped;
}

export function toEnvVariables(envVariables?: Record<string, unknown>) {
  if (!envVariables) return [];
  return Object.entries(envVariables).map(([key, raw]) => {
    let type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' = 'string';
    let value: string;
    if (raw === null || raw === undefined) {
      type = 'null';
      value = '';
    } else if (typeof raw === 'string') {
      type = 'string';
      value = raw;
    } else if (typeof raw === 'number') {
      type = 'number';
      value = String(raw);
    } else if (typeof raw === 'boolean') {
      type = 'boolean';
      value = String(raw);
    } else if (Array.isArray(raw)) {
      type = 'array';
      value = JSON.stringify(raw);
    } else {
      type = 'object';
      value = JSON.stringify(raw);
    }
    return { key, value, type, enabled: true, scope: 'env' as const };
  });
}

// ---------------------------------------------------------------------------
// Adapter helpers (serving the static playground app + config payload)
// ---------------------------------------------------------------------------

/**
 * Resolve the built playground app directory relative to the adapter bundle.
 * Each adapter is bundled flat into `dist/` (e.g. `dist/fastify.es.js`), so `./app`
 * resolves to `dist/app`.
 *
 * In the ESM bundle `import.meta.url` points at the bundle. In the CJS bundle the
 * bundler replaces `import.meta` with `{}` (so `importMetaUrl` is undefined) — there
 * we fall back to CommonJS `__dirname`, which is native and never evaluated in ESM.
 */
export function resolveDistAppPath(importMetaUrl: string): string {
  const dir = importMetaUrl ? path.dirname(fileURLToPath(importMetaUrl)) : __dirname;
  return path.resolve(dir, './app');
}

/** Read the playground `index.html` and rewrite the app.js script to the mounted endpoint. */
export function renderPlaygroundHtml(distAppPath: string, playgroundEndpoint: string): string {
  const htmlPath = path.join(distAppPath, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  return html.replaceAll(
    `<script type="module" src="app.js"></script>`,
    `<script type="module" src="${playgroundEndpoint}/app.js"></script>`,
  );
}

/** Validate `defaultData` and build the JSON payload served on `${playgroundEndpoint}/config`. */
export function buildConfigPayload<TRouter extends AnyTRPCRouter>({
  router,
  trpcEndpoint,
  transformer,
  projectKey,
  defaultData = {},
  envVariables,
}: {
  router: TRouter;
  trpcEndpoint: string;
  transformer?: 'superjson';
  projectKey?: string;
  defaultData?: ExportData;
  envVariables?: Record<string, unknown>;
}) {
  const validatedData = ExportDataSchema.safeParse(defaultData);
  if (!validatedData.success) {
    console.error('Invalid default data format', validatedData.error.issues);
    throw new Error('Invalid default data format');
  }

  const routerStructure = extractRouterStructure(router);

  return {
    trpcEndpoint,
    transformer,
    projectKey,
    endpoints: Object.keys(router._def.procedures),
    schema: stripZodSchemasForClient(routerStructure),
    defaultTabs: defaultData?.tabs || [
      {
        id: 'example-tab-1',
        title: 'Example 1',
        content: "trpc.hello.query({ name: 'monde test' })",
        isActive: true,
      },
    ],
    defaultHeaders: defaultData?.headers || [],
    envVariables: toEnvVariables(envVariables),
  };
}
