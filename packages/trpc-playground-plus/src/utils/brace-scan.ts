/**
 * Shared string-aware scanning primitives for partially-typed code.
 *
 * Used by the editor autocomplete to understand where the cursor sits inside a
 * (possibly incomplete) argument object. Pure functions — no React, no DOM.
 * `code-parser.ts` can adopt `scanBalanced` later; for now it stays independent.
 */

import { ARRAY_ITEMS } from './json-schema';

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

/**
 * Split a comma-separated list on its top-level commas only, ignoring commas that
 * appear inside strings or nested `()`/`{}`/`[]`. Segments are trimmed and empty
 * segments are dropped, so a trailing comma (`1, 2, `) does not produce a blank item.
 *
 * Used to parse array/argument literals in `code-parser.ts`.
 */
export function splitTopLevel(content: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let start = 0;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (ch === stringChar && content[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      segments.push(content.slice(start, i).trim());
      start = i + 1;
    }
  }
  segments.push(content.slice(start).trim());
  return segments.filter((s) => s.length > 0);
}

export interface CursorObjectContext {
  /**
   * Schema-descent path from the argument object down to the cursor: nested object
   * keys plus an `ARRAY_ITEMS` marker for each array the cursor is inside. Feed this
   * straight to `resolveSchemaAtPath`. e.g. inside `{ users: [{ | }] }` → `['users', ARRAY_ITEMS]`.
   */
  path: string[];
  /** Whether the cursor sits directly in an object `{ }` or an array `[ ]`. */
  container: 'object' | 'array';
  /** Keys already present in the innermost object scope (to avoid re-suggesting them). */
  usedKeys: Set<string>;
  /** Inner text of the innermost scope, up to the cursor. */
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
    kind: 'object' | 'array';
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

    if (ch === '{' || ch === '[') {
      stack.push({
        key: pendingKey,
        kind: ch === '{' ? 'object' : 'array',
        usedKeys: new Set(),
        contentStart: i + 1,
      });
      pendingKey = null;
      lastWord = null;
      i++;
      continue;
    }

    if (ch === '}' || ch === ']') {
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
  // Build the schema-descent path: each frame contributes its key (if any), and each
  // array frame contributes an ARRAY_ITEMS step so the resolver unwraps `schema.items`.
  const path: string[] = [];
  for (const frame of stack.slice(1)) {
    if (frame.key) path.push(frame.key);
    if (frame.kind === 'array') path.push(ARRAY_ITEMS);
  }
  const objectContent = text.slice(top.contentStart, limit);
  const valueMatch = objectContent.match(/(\w+)\s*:\s*(["']?)(\w*)$/);
  const valueSlot = valueMatch
    ? { key: valueMatch[1], quote: valueMatch[2], partial: valueMatch[3] }
    : undefined;

  return { path, container: top.kind, usedKeys: top.usedKeys, objectContent, valueSlot };
}

/** A half-open `[start, end)` offset range into a source string. */
export interface Span {
  start: number;
  end: number;
}

const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** Trim surrounding whitespace from a `[start, end)` span over `text`. */
function trimSpan(text: string, start: number, end: number): Span {
  while (start < end && isWs(text[start])) start++;
  while (end > start && isWs(text[end - 1])) end--;
  return { start, end };
}

/**
 * Read a single value starting at/after `from` (skipping leading whitespace),
 * bounded by `limit`. Objects/arrays/strings are read as balanced units; scalars
 * and JS expressions (`new Date()`) are read up to the next top-level `,`/`}`/`]`.
 */
function readValue(text: string, from: number, limit: number): Span {
  let i = from;
  while (i < limit && isWs(text[i])) i++;
  const start = i;
  const ch = text[i];
  if (ch === '{') return { start, end: scanBalanced(text, i, '{', '}').end };
  if (ch === '[') return { start, end: scanBalanced(text, i, '[', ']').end };
  if (ch === '"' || ch === "'") {
    let j = i + 1;
    while (j < limit) {
      if (text[j] === ch && text[j - 1] !== '\\') {
        j++;
        break;
      }
      j++;
    }
    return { start, end: j };
  }
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let j = i;
  for (; j < limit; j++) {
    const c = text[j];
    if (inString) {
      if (c === stringChar && text[j - 1] !== '\\') inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
    } else if (c === '(' || c === '{' || c === '[') {
      depth++;
    } else if (c === ')' || c === '}' || c === ']') {
      if (depth === 0) break;
      depth--;
    } else if (c === ',' && depth === 0) {
      break;
    }
  }
  return trimSpan(text, start, j);
}

/** Interior `[start, end)` of the object value `span` (drops the outer braces). */
function objectInterior(text: string, span: Span): Span | null {
  let i = span.start;
  while (i < span.end && isWs(text[i])) i++;
  if (text[i] !== '{') return null;
  const { end } = scanBalanced(text, i, '{', '}');
  return { start: i + 1, end: end - 1 };
}

/**
 * Walk an object interior `[s, e)` at top level, invoking `onKey` for each
 * `key:` found. `onKey` receives the key token span and the index just after the
 * colon; returning a non-null value stops the scan and is returned.
 */
function scanObjectKeys<T>(
  text: string,
  s: number,
  e: number,
  onKey: (key: string, keyStart: number, keyEnd: number, afterColon: number) => T | null,
): T | null {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = s; i < e; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === stringChar && text[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
    } else if (depth === 0 && IDENT.test(ch)) {
      let j = i;
      while (j < e && IDENT.test(text[j])) j++;
      const word = text.slice(i, j);
      let k = j;
      while (k < e && isWs(text[k])) k++;
      if (text[k] === ':') {
        const hit = onKey(word, i, j, k + 1);
        if (hit !== null) return hit;
      }
      i = j - 1;
    }
  }
  return null;
}

/** Span of the value of `key` inside an object interior `[s, e)`. */
function objectValueSpan(text: string, s: number, e: number, key: string): Span | null {
  return scanObjectKeys(text, s, e, (word, _ks, _ke, afterColon) =>
    word === key ? readValue(text, afterColon, e) : null,
  );
}

/** Span of the key token `key` inside an object interior `[s, e)`. */
function objectKeySpan(text: string, s: number, e: number, key: string): Span | null {
  return scanObjectKeys(text, s, e, (word, keyStart, keyEnd) =>
    word === key ? { start: keyStart, end: keyEnd } : null,
  );
}

/** Span of array element `#index` inside the array value `span`. */
function arrayElementSpan(text: string, span: Span, index: number): Span | null {
  let i = span.start;
  while (i < span.end && isWs(text[i])) i++;
  if (text[i] !== '[') return null;
  const { end } = scanBalanced(text, i, '[', ']');
  const innerStart = i + 1;
  const innerEnd = end - 1;

  let idx = 0;
  let elemStart = innerStart;
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let k = innerStart; k < innerEnd; k++) {
    const ch = text[k];
    if (inString) {
      if (ch === stringChar && text[k - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      if (idx === index) return trimSpan(text, elemStart, k);
      idx++;
      elemStart = k + 1;
    }
  }
  return idx === index ? trimSpan(text, elemStart, innerEnd) : null;
}

/** Locate the first `{ … }` object value in `text` (e.g. a call's argument object). */
function rootObjectSpan(text: string): Span | null {
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === stringChar && text[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') {
      return { start: i, end: scanBalanced(text, i, '{', '}').end };
    }
  }
  return null;
}

/** Descend `path` from the root object value to the value span at that path. */
function descend(text: string, path: string[]): Span | null {
  let span = rootObjectSpan(text);
  if (!span) return null;
  for (const seg of path) {
    if (/^\d+$/.test(seg)) {
      span = arrayElementSpan(text, span, Number(seg));
    } else {
      const interior = objectInterior(text, span);
      span = interior ? objectValueSpan(text, interior.start, interior.end, seg) : null;
    }
    if (!span) return null;
  }
  return span;
}

/**
 * Offset span of the value at `path` (object keys + numeric array indices) within
 * `text` — e.g. `['users', '1', 'name']` → the span of that item's `name` value.
 * Returns `null` when any segment can't be resolved (e.g. a missing key).
 */
export function findValueSpanAtPath(text: string, path: string[]): Span | null {
  return descend(text, path);
}

/**
 * Offset span of the *key token* for `path`'s last segment (the containing object
 * is resolved from the preceding segments). Used to highlight an unrecognized key.
 */
export function findKeySpanAtPath(text: string, path: string[]): Span | null {
  if (path.length === 0) return null;
  const parentSpan = descend(text, path.slice(0, -1));
  if (!parentSpan) return null;
  const interior = objectInterior(text, parentSpan);
  if (!interior) return null;
  return objectKeySpan(text, interior.start, interior.end, path[path.length - 1]);
}
