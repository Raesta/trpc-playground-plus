import { initTRPC } from '@trpc/server';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import fastify from 'fastify';
import { createFastifyAdapter } from 'trpc-playground-plus/adapters/fastify';
import { z } from 'zod';
import trpcPlaygroundTabs from './trpc-playground-tabs.json';

const app = fastify();
const t = initTRPC.create();

// Create a nested router for users
const userRouter = t.router({
  getById: t.procedure
    .input(z.string())
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `User with ID: ${input}` })),

  create: t.procedure
    .input(z.object({ name: z.string(), email: z.string() }))
    .output(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: `User created: ${input.name}` })),
});

// Create a nested router for posts
const postRouter = t.router({
  getById: t.procedure
    .input(z.object({ id: z.string() }))
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `Post with ID: ${input.id}` })),

  create: t.procedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .output(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: `Post created: ${input.title}` })),
});

// Router dedicated to exercising array parsing & validation (ROADMAP §1).
const arrayRouter = t.router({
  // Array of primitives: try { tags: ["a", 123] } → item 1 flagged (number vs string).
  tags: t.procedure
    .input(z.object({ tags: z.array(z.string()) }))
    .output(z.object({ count: z.number() }))
    .mutation(({ input }) => ({ count: input.tags.length })),

  // Array of objects: try { users: [{ name: "a" }, { name: 42 }] } → users.1.name flagged.
  users: t.procedure
    .input(z.object({ users: z.array(z.object({ name: z.string(), age: z.number().optional() })) }))
    .output(z.object({ names: z.array(z.string()) }))
    .mutation(({ input }) => ({ names: input.users.map((u) => u.name) })),

  // Nested arrays: try { grid: [[1, 2], ["x"]] } → grid.1.0 flagged.
  grid: t.procedure
    .input(z.object({ grid: z.array(z.array(z.number())) }))
    .output(z.object({ rows: z.number() }))
    .query(({ input }) => ({ rows: input.grid.length })),

  // Array of a discriminated union: each item narrows on `type`.
  // try { events: [{ type: "click", x: 1, y: 2 }, { type: "key", key: 9 }] } → events.1.key flagged.
  events: t.procedure
    .input(
      z.object({
        events: z.array(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
            z.object({ type: z.literal('key'), key: z.string() }),
          ]),
        ),
      }),
    )
    .output(z.object({ handled: z.number() }))
    .mutation(({ input }) => ({ handled: input.events.length })),
});

// Create the main router
const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string(), text: z.string().optional() }))
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `Hello, ${input.name}!` })),

  goodbye: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: `Goodbye, ${input.name}!` })),

  test: t.procedure
    .input(z.string())
    .output(z.string())
    .query(({ input }) => input),

  testSubRouter: t.router({
    test: t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ message: z.string() }))
      .query(({ input }) => ({ message: `Hello, ${input.name}!` })),
  }),

  testSubObject: t.procedure
    .input(
      z.object({
        name: z.string(),
        obj: z.object({
          text: z.string(),
        }),
      }),
    )
    .output(z.object({}))
    .query(({ input }) => ({ message: `Hello, ${JSON.stringify(input, null, 2)}!` })),

  testSubArray: t.procedure
    .input(
      z.object({
        name: z.string(),
        obj: z.object({
          text: z.string(),
        }),
      }),
    )
    .output(z.object({}))
    .query(({ input }) => ({ message: `Hello, ${JSON.stringify(input, null, 2)}!` })),

  setStatus: t.procedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['pending', 'active', 'archived']),
      }),
    )
    .output(z.object({ ok: z.boolean() }))
    .mutation(() => ({ ok: true })),

  sendNotification: t.procedure
    .input(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('email'),
          to: z.email(),
          subject: z.string(),
          body: z.string(),
        }),
        z.object({
          type: z.literal('sms'),
          phoneNumber: z.string(),
          message: z.string(),
        }),
        z.object({
          type: z.literal('push'),
          deviceToken: z.string(),
          title: z.string(),
          badge: z.number().optional(),
        }),
      ]),
    )
    .output(z.object({ delivered: z.boolean() }))
    .mutation(({ input }) => ({ delivered: input.type !== 'sms' })),

  // Constraint validation (min/max, length, email, regex, multipleOf, array bounds).
  // try: trpc.constrained.mutate({ email: "x", age: 5, code: "ab", quantity: 3, tags: [] })
  constrained: t.procedure
    .input(
      z.object({
        email: z.email(),
        age: z.number().min(18).max(120),
        code: z.string().length(6),
        quantity: z.number().int().multipleOf(5),
        tags: z.array(z.string()).min(1).max(3),
      }),
    )
    .output(z.object({ ok: z.boolean() }))
    .mutation(() => ({ ok: true })),

  // Non-object unions (scalar / literal / nullable).
  // try: trpc.setValue.mutate({ id: true }) → rejected (neither string nor number)
  setValue: t.procedure
    .input(
      z.object({
        id: z.union([z.string(), z.number()]),
        label: z.string().nullable(),
        size: z.union([z.literal('sm'), z.literal('md'), z.literal('lg')]),
      }),
    )
    .output(z.object({ ok: z.boolean() }))
    .mutation(() => ({ ok: true })),

  user: userRouter,
  post: postRouter,
  arrays: arrayRouter,
});

app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
  },
});

const playground = await createFastifyAdapter({
  app,
  trpcEndpoint: '/trpc',
  router: appRouter,
  playgroundEndpoint: '/playground',
  defaultData: trpcPlaygroundTabs,
  projectKey: 'funnel-api',
  envVariables: {
    API_URL: process.env.API_URL ?? 'https://api.example.com',
    TENANT_ID: process.env.TENANT_ID ?? 'tenant-default',
    DEBUG: process.env.DEBUG === 'true',
  },
});

playground.listen({ port: 4000 }, () => {
  console.log('🚀 Playground running at http://localhost:4000/playground');
});
