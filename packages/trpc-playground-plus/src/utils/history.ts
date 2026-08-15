import type { HistoryEntry } from '../types';
import { getStorageKey } from './storage-keys';

/** Default value for the `historySize` setting (max entries kept). */
export const DEFAULT_HISTORY_SIZE = 10;

/** Hard cap on a stored response's length so the journal can't bloat localStorage. */
const MAX_RESPONSE_LENGTH = 100_000;

/** Read the persisted history journal for a project (newest first). */
export function loadHistory(projectKey?: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey('history', projectKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* corrupted data */
  }
  return [];
}

/** Persist the history journal for a project. */
export function saveHistory(entries: HistoryEntry[], projectKey?: string): void {
  try {
    localStorage.setItem(getStorageKey('history', projectKey), JSON.stringify(entries));
  } catch {
    /* storage unavailable / quota exceeded */
  }
}

/**
 * Prepend a new entry (newest first) and cap the list to `max`. Pure — the cap is a
 * parameter driven by the `historySize` setting, so it can be unit-tested without a DOM.
 * A very large response is truncated to keep localStorage lean.
 */
export function addHistoryEntry(entries: HistoryEntry[], entry: HistoryEntry, max: number): HistoryEntry[] {
  const safeEntry: HistoryEntry =
    entry.response.length > MAX_RESPONSE_LENGTH
      ? { ...entry, response: `${entry.response.slice(0, MAX_RESPONSE_LENGTH)}\n… (truncated)` }
      : entry;
  const limit = Math.max(0, max);
  return [safeEntry, ...entries].slice(0, limit);
}

/** Human-friendly relative time, e.g. "à l'instant", "2 min", "1 h", "3 j". `now` injected for tests. */
export function formatRelativeTime(then: number, now: number): string {
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "à l'instant";
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} h`;
  const day = Math.floor(hour / 24);
  return `${day} j`;
}
