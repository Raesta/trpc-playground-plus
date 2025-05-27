# 🚀 tRPC Playground Plus

[![npm version](https://img.shields.io/npm/v/trpc-playground-plus.svg)](https://www.npmjs.com/package/trpc-playground-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/trpc-playground-plus.svg)](https://www.npmjs.com/package/trpc-playground-plus)

> Enhanced interactive playground for tRPC with tabs, request management, and much more.

## ✨ Features

- 📋 **Intuitive and modern user interface**
- 📑 **Tab system** to organize your queries/mutations
- 💾 **Export and import** queries to share with your team
- 🔄 **Automatic loading** of exported data (Tabs, Headers, etc.)
- 🔧 **HTTP headers customization**
- 🔌 **Adapters** for Fastify

## 🛠️ Coming Soon

- 🌈 **Support for more frameworks** (Express, Koa, etc.)
- 🧩 **More configuration options** to customize your experience
- 🎨 **Customizable themes (light/dark)**
- ...and much more!

Feel free to suggest ideas or contribute on [GitHub](https://github.com/raesta/trpc-playground-plus) !


## 📦 Installation

```bash
# npm
npm install trpc-playground-plus

# yarn
yarn add trpc-playground-plus

# pnpm
pnpm add trpc-playground-plus
```

## 🚀 Quick Start

### With Fastify

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

## 📋 Loading Predefined Queries

### Method: Configuration via an object or Json file

```typescript
import { createFastifyAdapter } from 'trpc-playground-plus/adapters/fastify';

const myTabs = {
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
  defaultData: myTabs
});
```

## 🧩 Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|------------|
| `trpcEndpoint` | `string` | tRPC API Endpoint | (required) |
| `router` | `Router` | tRPC Router | (required) |
| `playgroundEndpoint` | `string` | Playground path | `/playground` |
| `defaultData` | `object` | Path to configuration file or object | `undefined` |

## 🔧 Compatibility

Compatible with tRPC v11+.

## ❓ Why this project?

During a project, we encountered limitations with the `trpc-playground` solution, which is no longer maintained. This is a proof of concept (POC) created to address the specific needs we had, while providing a modern and maintainable alternative for exploring and testing tRPC APIs easily.

## 📄 License

[MIT](./LICENSE) © Rémy 'Raesta' Mulet