import type { PlaygroundSettings } from './types';
import { DEFAULT_RUN_KEY, DEFAULT_SEARCH_KEY } from './utils/keybinding';
import { getStorageKey } from './utils/storage-keys';

const DEFAULTS: PlaygroundSettings = {
  splitPosition: 50,
  fontSize: 15,
  theme: 'dark',
  requestTimeout: 0,
  keybindings: { run: DEFAULT_RUN_KEY, search: DEFAULT_SEARCH_KEY },
};

export function loadSettings(projectKey?: string): PlaygroundSettings {
  try {
    const raw = localStorage.getItem(getStorageKey('settings', projectKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        // Nested merge so a stored partial keybindings object doesn't drop defaults.
        keybindings: { ...DEFAULTS.keybindings, ...parsed.keybindings },
      };
    }
  } catch {
    /* corrupted data */
  }
  return { ...DEFAULTS, keybindings: { ...DEFAULTS.keybindings } };
}

export function saveSettings(partial: Partial<PlaygroundSettings>, projectKey?: string): void {
  const current = loadSettings(projectKey);
  localStorage.setItem(getStorageKey('settings', projectKey), JSON.stringify({ ...current, ...partial }));
}
