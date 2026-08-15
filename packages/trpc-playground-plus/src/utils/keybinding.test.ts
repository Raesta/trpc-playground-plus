import { describe, expect, it } from 'vitest';
import { eventToKeyString, formatKeyString, hasActionModifier, type KeyLikeEvent } from './keybinding';

const ev = (over: Partial<KeyLikeEvent> & { key: string }): KeyLikeEvent => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe('eventToKeyString', () => {
  it('serializes Cmd/Ctrl+Enter to Mod-Enter', () => {
    expect(eventToKeyString(ev({ key: 'Enter', metaKey: true }))).toBe('Mod-Enter');
    expect(eventToKeyString(ev({ key: 'Enter', ctrlKey: true }))).toBe('Mod-Enter');
  });

  it('serializes Shift+Alt+F to Shift-Alt-f (letter lowercased, order Mod/Alt/Shift)', () => {
    expect(eventToKeyString(ev({ key: 'F', altKey: true, shiftKey: true }))).toBe('Alt-Shift-f');
  });

  it('emits Mod before Alt before Shift', () => {
    expect(eventToKeyString(ev({ key: 's', metaKey: true, altKey: true, shiftKey: true }))).toBe('Mod-Alt-Shift-s');
  });

  it('maps space to Space', () => {
    expect(eventToKeyString(ev({ key: ' ', ctrlKey: true }))).toBe('Mod-Space');
  });

  it('keeps named keys as-is', () => {
    expect(eventToKeyString(ev({ key: 'ArrowUp', metaKey: true }))).toBe('Mod-ArrowUp');
    expect(eventToKeyString(ev({ key: 'F5' }))).toBe('F5');
  });

  it('returns null for a modifier-only keydown', () => {
    expect(eventToKeyString(ev({ key: 'Control', ctrlKey: true }))).toBeNull();
    expect(eventToKeyString(ev({ key: 'Meta', metaKey: true }))).toBeNull();
    expect(eventToKeyString(ev({ key: 'Shift', shiftKey: true }))).toBeNull();
  });

  it('serializes a bare letter (no modifier)', () => {
    expect(eventToKeyString(ev({ key: 'a' }))).toBe('a');
  });
});

describe('hasActionModifier', () => {
  it('is true when Mod/Ctrl/Cmd/Alt/Meta is present', () => {
    expect(hasActionModifier('Mod-Enter')).toBe(true);
    expect(hasActionModifier('Alt-Shift-f')).toBe(true);
    expect(hasActionModifier('Ctrl-k')).toBe(true);
  });
  it('is false for Shift-only or bare keys', () => {
    expect(hasActionModifier('Shift-a')).toBe(false);
    expect(hasActionModifier('a')).toBe(false);
    expect(hasActionModifier('Enter')).toBe(false);
  });
});

describe('formatKeyString', () => {
  it('renders modifiers and joins with +', () => {
    // Platform-dependent glyphs, but structure is stable: N parts joined by '+'.
    const out = formatKeyString('Mod-Enter');
    expect(out.split('+')).toHaveLength(2);
    expect(out.endsWith('Enter')).toBe(true);
  });
  it('uppercases a single-letter key', () => {
    expect(formatKeyString('Mod-s').endsWith('S')).toBe(true);
  });
  it('returns empty string for empty input', () => {
    expect(formatKeyString('')).toBe('');
  });
});
