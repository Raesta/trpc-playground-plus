import type { AnyTRPCRouter } from '@trpc/server';
import express from 'express';
import { buildConfigPayload, type ExportData, renderPlaygroundHtml, resolveDistAppPath } from './shared';

const distAppPath = resolveDistAppPath(import.meta.url);

type ExpressResponseLike = {
  type(contentType: string): ExpressResponseLike;
  send(body: unknown): unknown;
};

/**
 * Minimal structural shape of an Express application. Typing `app` structurally instead of as
 * `import('express').Express` keeps the adapter usable with Express 4 and 5 alike — their
 * `@types/express` majors are not mutually assignable — while the generic `TApp` below still
 * gives the caller back their own concrete app type.
 */
type ExpressAppLike = {
  get(path: string, handler: (req: any, res: ExpressResponseLike) => void): unknown;
  use(path: string, handler: any): unknown;
};

export function createExpressAdapter<TRouter extends AnyTRPCRouter, TApp extends ExpressAppLike>({
  app,
  trpcEndpoint,
  transformer,
  router,
  playgroundEndpoint = '/playground',
  defaultData = {},
  projectKey,
  envVariables,
}: {
  app: TApp;
  trpcEndpoint: string;
  router: TRouter;
  transformer?: 'superjson';
  playgroundEndpoint?: string;
  defaultData?: ExportData;
  projectKey?: string;
  envVariables?: Record<string, unknown>;
}) {
  // An Express application is a callable request handler, not a plain object.
  if (!app || (typeof app !== 'function' && typeof app !== 'object')) {
    throw new Error('Invalid app parameter: app must be an Express application');
  }

  if (typeof app.use !== 'function' || typeof app.get !== 'function') {
    throw new Error(
      'Invalid app parameter: app.use or app.get is not a function. Make sure you are passing a valid Express application',
    );
  }

  const configPayload = buildConfigPayload({
    router,
    trpcEndpoint,
    transformer,
    projectKey,
    defaultData,
    envVariables,
  });

  app.get(playgroundEndpoint, (_, res) => {
    res.type('html').send(renderPlaygroundHtml(distAppPath, playgroundEndpoint));
  });

  app.get(`${playgroundEndpoint}/config`, (_, res) => {
    res.type('json').send(configPayload);
  });

  // Registered after the routes above so `GET {playgroundEndpoint}` always renders the
  // rewritten HTML. `index: false` keeps express.static from serving the raw index.html,
  // which still points at the unprefixed `app.js`.
  app.use(playgroundEndpoint, express.static(distAppPath, { index: false }));

  return app;
}
