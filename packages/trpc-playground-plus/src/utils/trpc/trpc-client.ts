import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { AnyTRPCRouter } from '@trpc/server';
import superJSON from 'superjson';

interface CreateDynamicTRPCClientOptions {
  trpcUrl: string;
  transformer?: 'superjson'
  headers?: Record<string, string>;
}

export function createDynamicTRPCClient({ trpcUrl, transformer, headers }: CreateDynamicTRPCClientOptions) {
  return createTRPCClient({
    links: [
      httpBatchLink(
        transformer === 'superjson'
          ? {
            url: trpcUrl,
            transformer: superJSON,
            headers: headers || {},
          }
          : {
            url: trpcUrl,
            headers: headers || {},
          }
      ),
    ],
  });
}