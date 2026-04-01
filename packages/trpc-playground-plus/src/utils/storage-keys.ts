const BASE_KEYS = {
  tabs: 'trpc-playground-tabs',
  headers: 'trpc-playground-headers',
  variables: 'trpc-playground-variables',
  settings: 'trpc-playground-settings',
} as const;

export type StorageKeyName = keyof typeof BASE_KEYS;

export function getStorageKey(name: StorageKeyName, projectKey?: string): string {
  const base = BASE_KEYS[name];
  return projectKey ? `${projectKey}:${base}` : base;
}
