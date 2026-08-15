import { initTRPC } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RouterSchema } from '../types';
import { extractRouterStructure, stripZodSchemasForClient, toEnvVariables } from './shared';

describe('extractRouterStructure', () => {
  const t = initTRPC.create();
  const router = t.router({
    hello: t.procedure.input(z.object({ name: z.string() })).query(() => 'hi'),
    addUser: t.procedure.input(z.object({ name: z.string() })).mutation(() => true),
  });

  const structure = extractRouterStructure(router);

  it('classifies queries and mutations', () => {
    expect(structure.hello.type).toBe('query');
    expect(structure.addUser.type).toBe('mutation');
  });

  it('extracts both JSON and Zod input schemas', () => {
    const hello = structure.hello as Exclude<RouterSchema[string], { type: 'router' }>;
    expect(hello.inputSchema).toMatchObject({ type: 'object' });
    expect(hello.inputZodSchema).toBeTruthy();
  });
});

describe('stripZodSchemasForClient', () => {
  const schema: RouterSchema = {
    hello: {
      type: 'query',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'string' },
      inputZodSchema: { _def: 'zod' },
      outputZodSchema: { _def: 'zod' },
    },
    nested: {
      type: 'router',
      children: {
        add: {
          type: 'mutation',
          inputSchema: { type: 'number' },
          inputZodSchema: { _def: 'zod' },
        },
      },
    },
  };

  const stripped = stripZodSchemasForClient(schema);

  it('drops the Zod schemas but keeps the JSON schemas', () => {
    const hello = stripped.hello as Exclude<RouterSchema[string], { type: 'router' }>;
    expect(hello.inputSchema).toEqual({ type: 'object' });
    expect(hello.outputSchema).toEqual({ type: 'string' });
    expect('inputZodSchema' in hello).toBe(false);
    expect('outputZodSchema' in hello).toBe(false);
  });

  it('recurses into nested routers', () => {
    const nested = stripped.nested as Extract<RouterSchema[string], { type: 'router' }>;
    const add = nested.children?.add as Exclude<RouterSchema[string], { type: 'router' }>;
    expect(add.inputSchema).toEqual({ type: 'number' });
    expect('inputZodSchema' in add).toBe(false);
  });
});

describe('toEnvVariables', () => {
  it('returns [] when nothing is passed', () => {
    expect(toEnvVariables()).toEqual([]);
  });

  it('maps each JS type to a typed, enabled env variable', () => {
    const vars = toEnvVariables({
      s: 'hello',
      n: 42,
      b: true,
      nil: null,
      arr: [1, 2],
      obj: { a: 1 },
    });
    const byKey = Object.fromEntries(vars.map((v) => [v.key, v]));
    expect(byKey.s).toMatchObject({ type: 'string', value: 'hello', enabled: true, scope: 'env' });
    expect(byKey.n).toMatchObject({ type: 'number', value: '42' });
    expect(byKey.b).toMatchObject({ type: 'boolean', value: 'true' });
    expect(byKey.nil).toMatchObject({ type: 'null', value: '' });
    expect(byKey.arr).toMatchObject({ type: 'array', value: '[1,2]' });
    expect(byKey.obj).toMatchObject({ type: 'object', value: '{"a":1}' });
  });
});
