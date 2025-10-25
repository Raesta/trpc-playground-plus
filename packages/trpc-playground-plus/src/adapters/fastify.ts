import { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { AnyTRPCRouter } from '@trpc/server';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { type RouterSchema } from '../types';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));const distAppPath = path.resolve(__dirname, './app');

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

const ExportDataSchema = z.object({
  tabs: z.array(TabSchema).optional(),
  headers: z.array(HeaderSchema).optional(),
  createdAt: z.string().optional(),
});
type ExportData = z.infer<typeof ExportDataSchema>;

type ProcedureWithDef = Function & { _def?: { type?: string } };

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
      outputZodSchema: outputSchema || null
    };
  } catch (error) {
    console.warn('Error extracting schemas:', error);
    return {
      inputSchema: null,
      outputSchema: null,
      inputZodSchema: null,
      outputZodSchema: null
    };
  }
}

function extractRouterStructure(router: AnyTRPCRouter): RouterSchema {
  const structure: RouterSchema = {};

  Object.entries(router).forEach(([key, value]) => {
    if (key === '_def' || key === 'createCaller') return;

    if (hasDef(value) && value._def) {
      const def = value._def;
      const type: 'query' | 'mutation' | 'router' = def.type === 'query'
        ? 'query'
        : def.type === 'mutation'
        ? 'mutation'
        : 'router';

      const schemas = extractProcedureSchemas(def);
      structure[key] = { type, ...schemas };
    } else if (typeof value === 'object' && value !== null) {
      const hasProcedure = Object.values(value).some(
        (v) => hasDef(v) && v._def
      );

      if (hasProcedure) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (hasDef(subValue) && subValue._def) {
            const def = subValue._def;
            const type: 'query' | 'mutation' | 'router' = def.type === 'query'
              ? 'query'
              : def.type === 'mutation'
              ? 'mutation'
              : 'router';

            const schemas = extractProcedureSchemas(def);
            if (!structure[key]) structure[key] = { type: 'router', children: {} };
            (structure[key] as { type: 'router'; children: RouterSchema }).children[subKey] = { type, ...schemas };
          }
        });
      } else {
        structure[key] = {
          type: 'router',
          children: extractRouterStructure(value as AnyTRPCRouter)
        };
      }
    }
  });

  return structure;
}

function stripZodSchemasForClient(schema: RouterSchema): RouterSchema {
  const stripped: RouterSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    if (value.type === 'router') {
      stripped[key] = {
        type: 'router',
        children: value.children ? stripZodSchemasForClient(value.children) : undefined
      };
    } else {
      // Keep only inputSchema and outputSchema (JSON), not the Zod schemas
      const { inputZodSchema, outputZodSchema, ...rest } = value;
      stripped[key] = rest;
    }
  }

  return stripped;
}

export async function createFastifyAdapter<TRouter extends AnyTRPCRouter>({
  app,
  trpcEndpoint,
  transformer,
  router,
  playgroundEndpoint = '/playground',
  defaultData = {},
}: {
  app: FastifyInstance;
  trpcEndpoint: string;
  router: TRouter;
  transformer?: 'superjson';
  playgroundEndpoint?: string;
  defaultData?: ExportData;
}) {
  if (!app || typeof app !== 'object') {
    throw new Error('Invalid app parameter: app must be a FastifyInstance');
  }

  if (typeof app.register !== 'function') {
    throw new Error('Invalid app parameter: app.register is not a function. Make sure you are passing a valid FastifyInstance');
  }

  const validatedData = ExportDataSchema.safeParse(defaultData);

  if (!validatedData.success) {
    console.error('Invalid default data format', validatedData.error.issues);

    throw new Error('Invalid default data format');
  }

  try {
    await app.register(fastifyStatic, {
      root: distAppPath,
      prefix: playgroundEndpoint,
      decorateReply: false
    });
  } catch (error) {
    console.error('Error registering fastify-static plugin:', error);
    throw new Error(`Failed to register fastify-static plugin: ${error instanceof Error ? error.message : String(error)}`);
  }

  app.get(playgroundEndpoint, (_, reply) => {
    const htmlPath = path.join(distAppPath, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    html = html.replaceAll(
      `<script type="module" src="app.js"></script>`,
      `<script type="module" src="${playgroundEndpoint}/app.js"></script>`
    )

    reply.type('text/html').send(html);
  });

  const routerStructure = extractRouterStructure(router);

  app.get(`${playgroundEndpoint}/config`, (_, reply) => {
    reply.header('Content-Type', 'application/json');
    reply.send({
      trpcEndpoint,
      transformer,
      endpoints: Object.keys(router._def.procedures),
      schema: stripZodSchemasForClient(routerStructure),
      defaultTabs: defaultData?.tabs || [{ id: 'example-tab-1', title: 'Example 1', content: 'trpc.hello.query({ name: \'monde test\' })', isActive: true }],
      defaultHeaders: defaultData?.headers || []
    });
  });

  return app;
}