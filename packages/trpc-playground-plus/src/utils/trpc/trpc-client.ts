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
    function createProxyChain(path: string[] = []): any {
      return new Proxy({}, {
        get(_, prop) {
          const currentPath = [...path, String(prop)];

          if (prop === 'query' || prop === 'mutate') {
            return async function(input: any) {
              const method = prop === 'query' ? 'GET' : 'POST';
              const url = `${trpcUrl}/${currentPath.slice(0, -1).join('.')}`;

              const requestOptions: RequestInit = {
                method,
                headers: {
                  'Content-Type': 'application/json',
                  ...headers,
                },
              };

              const makeRequest = async () => {
                if (method === 'GET') {
                  // For GET requests, serialize with superJSON and pass as query parameter
                  const serializedInput = superJSON.stringify(input);
                  const params = new URLSearchParams();

                  if (input !== undefined) {
                    params.set('input', serializedInput);
                  }

                  const finalUrl = params.toString() ? `${url}?${params}` : url;

                  return await fetch(finalUrl, requestOptions);
                } else {
                  // For POST requests, serialize with superJSON in body
                  const serializedInput = superJSON.stringify(input);

                  requestOptions.body = serializedInput;

                  return await fetch(url, requestOptions);
                }
              };

              const response = await makeRequest();
              const data = await response.json();

              if (data.error) {
                try {
                  console.log("data error", data)
                  console.log("here 1")
                  const parsedMessage = JSON.parse(data.error.json);
                  return {
                    ...data.error,
                    json: {
                      ...data.error.json,
                      message: parsedMessage,
                    }
                  }
                } catch (error) {
                  console.log("error", JSON.stringify(error, null, 2))
                  console.log("here 3")
                  // If parsing fails, return the original error
                  return data.error;
                }
              }

              // If data.result is already an object, return it directly
              // Otherwise, try to deserialize it with superJSON
              if (data.result && typeof data.result === 'object' && data.result !== null) {
                return data.result.data;
              } else if (data.result) {
                return superJSON.parse(data.result.data);
              }

              return null;
            };
          }

          // Continue building the proxy chain for deeper nesting
          return createProxyChain(currentPath);
        }
      });
    }

    return createProxyChain();
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