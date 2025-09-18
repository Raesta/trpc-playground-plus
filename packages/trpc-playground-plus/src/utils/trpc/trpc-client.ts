import { createTRPCClient, httpBatchLink, httpLink } from '@trpc/client';
import superJSON from 'superjson';

interface CreateDynamicTRPCClientOptions {
  trpcUrl: string;
  transformer?: 'superjson';
  headers?: Record<string, string>;
}

export function createDynamicTRPCClient({ trpcUrl, transformer, headers }: CreateDynamicTRPCClientOptions) {
  // tRPC client configuration

  if (transformer === 'superjson') {
    // For superJSON, create a custom client that handles serialization manually
    return new Proxy({}, {
      get(target, prop) {
        return new Proxy({}, {
          get(innerTarget, innerProp) {
            if (innerProp === 'query' || innerProp === 'mutate') {
              return async function(input: any) {
                const method = innerProp === 'query' ? 'GET' : 'POST';
                const url = `${trpcUrl}/${String(prop)}`;

                // Serialize input as normal JSON (not superJSON)
                const serializedInput = JSON.stringify(input);

                const requestOptions: RequestInit = {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                  },
                };

                if (method === 'GET') {
                  const params = new URLSearchParams({ input: serializedInput });
                  const response = await fetch(`${url}?${params}`, requestOptions);
                  const data = await response.json();

                  if (data.error) {
                    try {
                      return {
                        ...data.error,
                        message: JSON.parse(data.error.message),
                      }
                    } catch (error) {
                      return data.error;
                    }
                  }

                  // If data.result is already an object, return it directly
                  // Otherwise, try to deserialize it with superJSON
                  if (typeof data.result === 'object' && data.result !== null) {
                    return data.result.data;
                  } else {
                    return superJSON.parse(data.result.data);
                  }
                } else {
                  requestOptions.body = serializedInput;
                  const response = await fetch(url, requestOptions);
                  const data = await response.json();

                  if (data.error) {
                    try {
                      return {
                        ...data.error,
                        message: JSON.parse(data.error.message),
                      }
                    } catch (error) {
                      return data.error;
                    }
                  }

                  // If data.result is already an object, return it directly
                  // Otherwise, try to deserialize it with superJSON
                  if (typeof data.result === 'object' && data.result !== null) {
                    return data.result.data;
                  } else {
                    return superJSON.parse(data.result.data);
                  }
                }
              };
            }

            return new Proxy({}, {
              get() {
                return function() {
                  throw new Error('Method not implemented');
                };
              }
            });
          }
        });
      }
    });
  }

  // For normal requests, use the standard tRPC client
  return createTRPCClient({
    links: [
      httpLink({
        url: trpcUrl,
        headers: headers || {},
      })
    ],
  });
}