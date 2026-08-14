/**
 * Keyboard-shortcut helpers, shared by the Settings capture control and the editor.
 * Bindings are stored in CodeMirror key syntax (e.g. `Mod-Enter`, `Shift-Alt-f`),
 * where `Mod` means Cmd on macOS and Ctrl elsewhere. Pure — no React, no DOM globals
 * beyond the passed-in event.
 */

/** Default shortcut for running the tRPC call at the cursor.
 *  Alt/Option+Enter — `Mod-Enter` is taken by CodeMirror for inserting a line break. */
export const DEFAULT_RUN_KEY = 'Alt-Enter';

/** Default shortcut for opening the search panel (CodeMirror's native `Mod-f`). */
export const DEFAULT_SEARCH_KEY = 'Mod-f';

/** Minimal shape of a keyboard event we need to serialize (matches KeyboardEvent). */
export interface KeyLikeEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS', 'AltGraph', 'CapsLock']);

/** True on macOS-like platforms (affects `Mod` display and nothing else). */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
}

/** Normalize the non-modifier key of an event to CodeMirror's naming. */
function normalizeKey(key: string): string {
  if (key === ' ' || key === 'Spacebar') return 'Space';
  if (key.length === 1) return key.toLowerCase();
  return key; // Enter, Escape, ArrowUp, F5, Tab, …
}

/**
 * Serialize a keyboard event to a CodeMirror key string, or `null` when only a
 * modifier is held (an incomplete combination). `Mod` is emitted for Ctrl/Cmd so the
 * binding stays portable across platforms.
 */
export function eventToKeyString(e: KeyLikeEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Mod');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(normalizeKey(e.key));
  return parts.join('-');
}

/**
 * True when the binding carries an "action" modifier (Mod/Ctrl/Cmd/Alt/Meta). Shift
 * alone doesn't count — a Shift-only combo would just type into the editor.
 */
export function hasActionModifier(key: string): boolean {
  return /(^|-)(Mod|Ctrl|Cmd|Meta|Alt)(-|$)/.test(key);
}

/** Human-readable rendering of a stored key string (platform-aware). */
export function formatKeyString(key: string): string {
  if (!key) return '';
  const mac = isMac();
  const labels: Record<string, string> = {
    Mod: mac ? '⌘' : 'Ctrl',
    Meta: mac ? '⌘' : 'Meta',
    Ctrl: 'Ctrl',
    Cmd: '⌘',
    Alt: mac ? '⌥' : 'Alt',
    Shift: mac ? '⇧' : 'Shift',
  };
  return key
    .split('-')
    .map((part) => labels[part] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join('+');
}
