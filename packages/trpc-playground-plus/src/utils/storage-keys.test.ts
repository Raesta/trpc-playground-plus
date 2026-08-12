import { describe, expect, it } from 'vitest';
import { getStorageKey } from './storage-keys';

describe('getStorageKey', () => {
  it('returns the base key when no project key is given', () => {
    expect(getStorageKey('tabs')).toBe('trpc-playground-tabs');
    expect(getStorageKey('drawerSections')).toBe('trpc-playground-drawer-sections');
  });

  it('namespaces the key with the project key', () => {
    expect(getStorageKey('tabs', 'proj')).toBe('proj:trpc-playground-tabs');
    expect(getStorageKey('settings', 'proj')).toBe('proj:trpc-playground-settings');
  });
});
