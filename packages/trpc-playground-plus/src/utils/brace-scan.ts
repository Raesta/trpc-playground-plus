/**
 * Shared string-aware scanning primitives for partially-typed code.
 *
 * Used by the editor autocomplete to understand where the cursor sits inside a
 * (possibly incomplete) argument object. Pure functions — no React, no DOM.
 * `code-parser.ts` can adopt `scanBalanced` later; for now it stays independent.
 */

const IDENT = /[A-Za-z0-9_$]/;

export interface ScanResult {
  /** Index just past the matching close delimiter (or text length if unbalanced). */
  end: number;
  /** Inner content between the delimiters. */
  content: string;
}

/**
 * Scan from an opening delimiter to its matching close, ignoring delimiters that
 * appear inside single/double-quoted strings (with backslash escapes).
 */
export function scanBalanced(text: string, start: number, open: string, close: string): ScanResult {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === stringChar && text[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return { end: i + 1, content: text.slice(start + 1, i) };
    }
  }
  return { end: text.length, content: text.slice(start + 1) };
}

export interface CursorObjectContext {
  /** Nested object keys the cursor is inside, from the argument object down to the cursor. */
  path: string[];
  /** Keys already present in the innermost object scope (to avoid re-suggesting them). */
  usedKeys: Set<string>;
  /** Inner text of the innermost object scope, up to the cursor. */
  objectContent: string;
  /** Set when the cursor sits in a value position right after `key: `. */
  valueSlot?: { key: string; quote: string; partial: string };
}

/**
 * Locate the cursor within a (possibly incomplete) argument object and report the
 * nesting path, the keys already used in the current scope, and whether the cursor
 * is in a value slot. Returns `null` when the cursor is not inside any object.
 *
 * `text` should start at/around the argument object; only `text[0..cursorOffset)`
 * is examined. A stack of object frames is maintained so keys are scoped per level.
 */
export function findCursorObjectContext(text: string, cursorOffset: number): CursorObjectContext | null {
  interface Frame {
    key: string | null;
    usedKeys: Set<string>;
    contentStart: number;
  }
  const stack: Frame[] = [];
  let pendingKey: string | null = null; // identifier seen before ':' at the current level
  let lastWord: string | null = null; // most recent identifier run
  let inString = false;
  let stringChar = '';

  const limit = Math.min(cursorOffset, text.length);
  let i = 0;
  while (i < limit) {
    const ch = text[i];

    if (inString) {
      if (ch === stringChar && text[i - 1] !== '\\') inString = false;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      lastWord = null;
      i++;
      continue;
    }

    if (IDENT.test(ch)) {
      let j = i;
      while (j < limit && IDENT.test(text[j])) j++;
      lastWord = text.slice(i, j);
      i = j;
      continue;
    }

    if (ch === ':') {
      pendingKey = lastWord;
      if (stack.length && lastWord) stack[stack.length - 1].usedKeys.add(lastWord);
      lastWord = null;
      i++;
      continue;
    }

    if (ch === '{') {
      stack.push({ key: pendingKey, usedKeys: new Set(), contentStart: i + 1 });
      pendingKey = null;
      lastWord = null;
      i++;
      continue;
    }

    if (ch === '}') {
      stack.pop();
      pendingKey = null;
      lastWord = null;
      i++;
      continue;
    }

    if (ch === ',') {
      // Shorthand property (`{ name, age }`): a bare identifier with no following ':'.
      if (stack.length && lastWord && pendingKey === null) stack[stack.length - 1].usedKeys.add(lastWord);
      pendingKey = null;
      lastWord = null;
      i++;
      continue;
    }

    lastWord = null;
    i++;
  }

  if (stack.length === 0) return null;

  const top = stack[stack.length - 1];
  const path = stack
    .slice(1)
    .map((f) => f.key)
    .filter((k): k is string => !!k);
  const objectContent = text.slice(top.contentStart, limit);
  const valueMatch = objectContent.match(/(\w+)\s*:\s*(["']?)(\w*)$/);
  const valueSlot = valueMatch
    ? { key: valueMatch[1], quote: valueMatch[2], partial: valueMatch[3] }
    : undefined;

  return { path, usedKeys: top.usedKeys, objectContent, valueSlot };
}
