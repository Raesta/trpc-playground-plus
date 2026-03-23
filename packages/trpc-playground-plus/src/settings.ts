import { PlaygroundSettings } from './types';

const STORAGE_KEY = 'trpc-playground-settings';

const DEFAULTS: PlaygroundSettings = {
  splitPosition: 50,
  fontSize: 15,
};

export function loadSettings(): PlaygroundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupted data */ }
  return { ...DEFAULTS };
}

export function saveSettings(partial: Partial<PlaygroundSettings>): void {
  const current = loadSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
}
