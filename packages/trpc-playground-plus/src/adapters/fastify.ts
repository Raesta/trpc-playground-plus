import fastifyStatic from '@fastify/static';
import type { AnyTRPCRouter } from '@trpc/server';
import type { FastifyInstance } from 'fastify';
import { buildConfigPayload, type ExportData, renderPlaygroundHtml, resolveDistAppPath } from './shared';

const distAppPath = resolveDistAppPath(import.meta.url);

export async function createFastifyAdapter<TRouter extends AnyTRPCRouter>({
  app,
  trpcEndpoint,
  transformer,
  router,
  playgroundEndpoint = '/playground',
  defaultData = {},
  projectKey,
  envVariables,
}: {
  app: FastifyInstance;
  trpcEndpoint: string;
  router: TRouter;
  transformer?: 'superjson';
  playgroundEndpoint?: string;
  defaultData?: ExportData;
  projectKey?: string;
  envVariables?: Record<string, unknown>;
}) {
  if (!app || typeof app !== 'object') {
    throw new Error('Invalid app parameter: app must be a FastifyInstance');
  }

  if (typeof app.register !== 'function') {
    throw new Error(
      'Invalid app parameter: app.register is not a function. Make sure you are passing a valid FastifyInstance',
    );
  }

  try {
    await app.register(fastifyStatic, {
      root: distAppPath,
      prefix: playgroundEndpoint,
      decorateReply: false,
    });
  } catch (error) {
    console.error('Error registering fastify-static plugin:', error);
    throw new Error(
      `Failed to register fastify-static plugin: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  app.get(playgroundEndpoint, (_, reply) => {
    reply.type('text/html').send(renderPlaygroundHtml(distAppPath, playgroundEndpoint));
  });

  const configPayload = buildConfigPayload({
    router,
    trpcEndpoint,
    transformer,
    projectKey,
    defaultData,
    envVariables,
  });

  app.get(`${playgroundEndpoint}/config`, (_, reply) => {
    reply.header('Content-Type', 'application/json');
    reply.send(configPayload);
  });

  return app;
}
