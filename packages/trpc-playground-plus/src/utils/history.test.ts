import { beforeEach, describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../types';
import { addHistoryEntry, formatRelativeTime, loadHistory, saveHistory } from './history';
import { getStorageKey } from './storage-keys';

function makeEntry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: over.id ?? 'id',
    timestamp: over.timestamp ?? 0,
    code: over.code ?? 'trpc.a.query(1)',
    response: over.response ?? '{}',
    procedure: over.procedure ?? 'a',
    method: over.method ?? 'query',
    durationMs: over.durationMs ?? 10,
    status: over.status ?? 'ok',
  };
}

// Minimal in-memory localStorage for the node test environment.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('addHistoryEntry', () => {
  it('prepends the new entry (newest first)', () => {
    const a = makeEntry({ id: 'a' });
    const b = makeEntry({ id: 'b' });
    const result = addHistoryEntry([a], b, 10);
    expect(result.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('caps the list to the given max', () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < 15; i++) entries = addHistoryEntry(entries, makeEntry({ id: `e${i}` }), 10);
    expect(entries).toHaveLength(10);
    expect(entries[0].id).toBe('e14');
    expect(entries[9].id).toBe('e5');
  });

  it('honours a different max', () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < 15; i++) entries = addHistoryEntry(entries, makeEntry({ id: `e${i}` }), 3);
    expect(entries.map((e) => e.id)).toEqual(['e14', 'e13', 'e12']);
  });

  it('truncates an oversized response', () => {
    const huge = 'x'.repeat(200_000);
    const [entry] = addHistoryEntry([], makeEntry({ response: huge }), 10);
    expect(entry.response.length).toBeLessThan(huge.length);
    expect(entry.response).toContain('(truncated)');
  });
});

describe('loadHistory / saveHistory', () => {
  it('round-trips entries', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    saveHistory(entries, 'proj');
    expect(loadHistory('proj')).toEqual(entries);
  });

  it('namespaces by projectKey', () => {
    saveHistory([makeEntry({ id: 'p1' })], 'p1');
    saveHistory([makeEntry({ id: 'p2' })], 'p2');
    expect(loadHistory('p1')[0].id).toBe('p1');
    expect(loadHistory('p2')[0].id).toBe('p2');
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] on corrupted data', () => {
    localStorage.setItem(getStorageKey('history', 'proj'), '{not json');
    expect(loadHistory('proj')).toEqual([]);
  });

  it('returns [] when nothing is stored', () => {
    expect(loadHistory('proj')).toEqual([]);
  });
});

describe('formatRelativeTime', () => {
  const now = 1_000_000_000;
  it('shows "à l\'instant" for very recent', () => {
    expect(formatRelativeTime(now - 3_000, now)).toBe("à l'instant");
  });
  it('shows seconds', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('30 s');
  });
  it('shows minutes', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min');
  });
  it('shows hours', () => {
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 h');
  });
  it('shows days', () => {
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2 j');
  });
});
