import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { initTRPC } from '@trpc/server';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createExpressAdapter } from './express';

const t = initTRPC.create();
const appRouter = t.router({
  hello: t.procedure.input(z.object({ name: z.string() })).query(() => 'hi'),
  users: t.router({
    create: t.procedure.input(z.object({ name: z.string() })).mutation(() => true),
  }),
});

// The adapter reads `dist/app/index.html`, which does not exist when Vitest runs the
// sources (`resolveDistAppPath` then points at `src/adapters/app`). Serve a stub instead
// and let every other read through.
const FAKE_HTML = '<!DOCTYPE html><body><script type="module" src="app.js"></script></body>';

beforeAll(() => {
  const realReadFileSync = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor, options?: unknown) => {
    if (typeof filePath === 'string' && filePath.endsWith('index.html')) return FAKE_HTML;
    return (realReadFileSync as (p: fs.PathOrFileDescriptor, o?: unknown) => string | Buffer)(filePath, options);
  }) as typeof fs.readFileSync);
});

afterAll(() => {
  vi.restoreAllMocks();
});

/** Start `app` on a random free port and return a `fetch` bound to it, plus a closer. */
async function serve(app: Express) {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    get: (path: string) => fetch(`http://127.0.0.1:${port}${path}`),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function createApp(playgroundEndpoint?: string) {
  const app = express();
  createExpressAdapter({
    app,
    trpcEndpoint: '/trpc',
    router: appRouter,
    playgroundEndpoint,
    projectKey: 'test-project',
    envVariables: { API_URL: 'https://api.example.com' },
  });
  return app;
}

describe('createExpressAdapter', () => {
  it('rejects a missing or non-object app', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createExpressAdapter({ app: undefined, trpcEndpoint: '/trpc', router: appRouter })).toThrow(
      /must be an Express application/,
    );
  });

  it('rejects an object that is not an Express application', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createExpressAdapter({ app: {}, trpcEndpoint: '/trpc', router: appRouter })).toThrow(
      /app.use or app.get is not a function/,
    );
  });

  it('returns the app instance so it stays chainable', () => {
    const app = express();
    expect(createExpressAdapter({ app, trpcEndpoint: '/trpc', router: appRouter })).toBe(app);
  });

  it('serves the playground HTML with the script rewritten to the mounted endpoint', async () => {
    const server = await serve(createApp());
    try {
      const res = await server.get('/playground');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
      expect(await res.text()).toContain('<script type="module" src="/playground/app.js"></script>');
    } finally {
      await server.close();
    }
  });

  it('serves the config payload as JSON', async () => {
    const server = await serve(createApp());
    try {
      const res = await server.get('/playground/config');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);

      const config = await res.json();
      expect(config.trpcEndpoint).toBe('/trpc');
      expect(config.projectKey).toBe('test-project');
      expect(config.schema.hello.type).toBe('query');
      expect(config.schema.users.children.create.type).toBe('mutation');
      expect(config.envVariables).toEqual([
        { key: 'API_URL', value: 'https://api.example.com', type: 'string', enabled: true, scope: 'env' },
      ]);
      // Zod schemas are not serializable and must never reach the client.
      expect('inputZodSchema' in config.schema.hello).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('honours a custom playgroundEndpoint', async () => {
    const server = await serve(createApp('/dev/api-playground'));
    try {
      const html = await server.get('/dev/api-playground');
      expect(html.status).toBe(200);
      expect(await html.text()).toContain('src="/dev/api-playground/app.js"');

      const config = await server.get('/dev/api-playground/config');
      expect(config.status).toBe(200);

      expect((await server.get('/playground')).status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
