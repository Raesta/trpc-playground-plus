import fastify from 'fastify'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { createFastifyAdapter } from 'trpc-playground-plus'
import superJSON from 'superjson'
import trpcPlaygroundTabs from './trpc-playground-tabs.json'

const app = fastify()
const t = initTRPC.create()

// Create a nested router for users
const userRouter = t.router({
  getById: t.procedure
    .input(z.string())
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `User with ID: ${input}` })),

  create: t.procedure
    .input(z.object({ name: z.string(), email: z.string() }))
    .output(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: `User created: ${input.name}` }))
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
    .mutation(({ input }) => ({ message: `Post created: ${input.title}` }))
});

// Create the main router
const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `Hello, ${input.name}!` })),

  goodbye: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: `Goodbye, ${input.name}!` })),

  user: userRouter,
  post: postRouter
});

app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    transformer: superJSON,
    router: appRouter,
    createContext: () => ({})
  }
})

const playground = await createFastifyAdapter({
  app,
  trpcEndpoint: '/trpc',
  transformer: 'superjson',
  router: appRouter,
  playgroundEndpoint: '/playground',
  defaultData: trpcPlaygroundTabs
})

playground.listen({ port: 4000 }, () => {
  console.log('🚀 Playground running at http://localhost:4000/playground')
})
