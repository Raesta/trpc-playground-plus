# 🚀 tRPC Playground Plus

[![npm version](https://img.shields.io/npm/v/trpc-playground-plus.svg)](https://www.npmjs.com/package/trpc-playground-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/trpc-playground-plus.svg)](https://www.npmjs.com/package/trpc-playground-plus)

> Enhanced interactive playground for tRPC with tabs, request management, and much more.

## ✨ Features

- 📋 **Intuitive and modern user interface**
- 📑 **Tab system** to organize your queries/mutations
- 💾 **Export and import** queries to share with your team
- 🔄 **Default data loading** for new users (Tabs, Headers, etc.)
- 🔧 **HTTP headers customization** (global & per-tab)
- 🧬 **Variables support** with type validation (global & per-tab)
- 🌱 **Environment variables injection** (read-only, provided by the server)
- 🕑 **Request history** — replay, view, and diff (input & output) past calls side-by-side
- ✨ **Smart autocomplete & inline linting** based on your tRPC schema — deep support for nested objects, arrays, discriminated unions, and schema constraints (min/max, patterns, formats…)
- ⌨️ **Configurable keyboard shortcuts** (run & search)
- 🎨 **Light & dark themes**
- ⚙️ **Customizable settings** (font size, timeout, split, history size, shortcuts)
- 🪄 **Built-in code formatter**
- 🏢 **Monorepo-friendly** (isolate data per project)
- 🔌 **Adapters** for Fastify

## 🛠️ Coming Soon

- 🌈 **Support for more frameworks** (Express, Koa, Next.js, Hono…)
- 📡 **Subscriptions** support (WebSocket)
- ...and much more!

Feel free to suggest ideas or contribute on [GitHub](https://github.com/raesta/trpc-playground-plus) !


## 📦 Installation

It's a dev tool, so install it as a dev dependency:

```bash
# npm
npm install --save-dev trpc-playground-plus

# yarn
yarn add --dev trpc-playground-plus

# pnpm
pnpm add --save-dev trpc-playground-plus
```

## 🚀 Quick Start

<details open>
  <summary>With Fastify</summary>

  ```typescript
  import { createFastifyAdapter } from 'trpc-playground-plus/adapters/fastify';
  import { fastify } from 'fastify';
  import { appRouter } from './router';

  const app = fastify();

  // Playground configuration
  await createFastifyAdapter({
    app,
    trpcEndpoint: 'http://localhost:3000/api/trpc',
    router: appRouter,
    playgroundEndpoint: '/playground'
  });

  // Start server
  await app.listen({ port: 3000 });
  console.log('🚀 Server available at http://localhost:3000');
  console.log('🚀 Playground available at http://localhost:3000/playground');
  ```
</details>

## 📋 Loading Default Queries

### Method: Configuration via an object or Json file

```typescript
import { createFastifyAdapter } from 'trpc-playground-plus/adapters/fastify';

const myData = {
  tabs: [
    {
      id: "tab-1",
      title: "Get all users",
      content: "trpc.user.getAll.query()",
      isActive: true
    },
  ],
  headers: [
    {
      key: "Authorization",
      value: "Bearer your-token-here",
      enabled: true
    }
  ],
};

await createFastifyAdapter({
  app: fastify,
  trpcEndpoint: '/api/trpc',
  playgroundEndpoint: '/playground',
  router: appRouter,
  defaultData: myData // <- defaultData is optional but recommended for new user
});
```

## 🧩 Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|------------|
| `app` | `FastifyInstance` | Fastify instance | (required) |
| `trpcEndpoint` | `string` | tRPC API Endpoint | (required) |
| `router` | `Router` | tRPC Router | (required) |
| `playgroundEndpoint` | `string` | Playground path | `/playground` |
| `transformer` | `'superjson'` | Data transformer used by your tRPC client | `undefined` |
| `defaultData` | `ExportData` | Default tabs/headers to bootstrap the playground | `undefined` |
| `envVariables` | `Record<string, unknown>` | Read-only variables injected by the server, usable in queries by their key (like any variable) | `undefined` |
| `projectKey` | `string` | Prefix for localStorage keys (monorepo isolation) | `undefined` |

## 🏢 Monorepo Support

If you use **trpc-playground-plus** in multiple projects served on the same domain (typical in a monorepo), the localStorage data would normally collide. Set a unique `projectKey` per project to isolate them:

```typescript
// App A
await createFastifyAdapter({
  app,
  trpcEndpoint: '/api/trpc',
  router: appRouter,
  projectKey: 'app-a',
});

// App B (different project in same monorepo)
await createFastifyAdapter({
  app,
  trpcEndpoint: '/api/trpc',
  router: appRouter,
  projectKey: 'app-b',
});
```

localStorage keys are then prefixed (e.g. `app-a:trpc-playground-tabs`), avoiding collisions. The `projectKey` is also embedded in exported JSON files so imports can warn when data is brought over from a different project.

## 🔧 Compatibility

Compatible with tRPC v11+ and zod 4.

## ❓ Why this project?

During a project, we encountered limitations with the `trpc-playground` solution, which is no longer maintained. It started as a proof of concept (POC) to address the specific needs we had — but it has since grown well beyond that into a real, actively maintained alternative for exploring and testing tRPC APIs, with a modern UI, smart autocomplete & linting, request history, environment variables, and an extensible multi-adapter architecture.

## 📄 License

[MIT](./LICENSE) © Rémy 'Raesta' Mulet