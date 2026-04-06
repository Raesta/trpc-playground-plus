import type { PlaygroundSettings } from './types';
import { getStorageKey } from './utils/storage-keys';

const DEFAULTS: PlaygroundSettings = {
  splitPosition: 50,
  fontSize: 15,
  theme: 'dark',
  requestTimeout: 0,
};

export function loadSettings(projectKey?: string): PlaygroundSettings {
  try {
    const raw = localStorage.getItem(getStorageKey('settings', projectKey));
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* corrupted data */
  }
  return { ...DEFAULTS };
}

export function saveSettings(partial: Partial<PlaygroundSettings>, projectKey?: string): void {
  const current = loadSettings(projectKey);
  localStorage.setItem(getStorageKey('settings', projectKey), JSON.stringify({ ...current, ...partial }));
}
