import { describe, expect, it } from 'vitest';
import { findCursorObjectContext, scanBalanced } from './brace-scan';

describe('scanBalanced', () => {
  it('scans a balanced object', () => {
    const res = scanBalanced('{ a: 1 }', 0, '{', '}');
    expect(res.content).toBe(' a: 1 ');
    expect(res.end).toBe(8);
  });

  it('ignores delimiters inside strings', () => {
    const res = scanBalanced('{ a: "}" }', 0, '{', '}');
    expect(res.content).toBe(' a: "}" ');
  });

  it('respects escaped quotes', () => {
    // source string is: { a: "x\"}" }  — the escaped quote keeps us in the string,
    // so the `}` inside must not close the object.
    const res = scanBalanced(`{ a: "x\\"}" }`, 0, '{', '}');
    expect(res.content).toBe(' a: "x\\"}" ');
  });

  it('handles nesting', () => {
    const res = scanBalanced('{ a: { b: 1 } }', 0, '{', '}');
    expect(res.content).toBe(' a: { b: 1 } ');
  });

  it('returns text length when unbalanced', () => {
    const res = scanBalanced('{ a: 1', 0, '{', '}');
    expect(res.end).toBe(6);
    expect(res.content).toBe(' a: 1');
  });
});

describe('findCursorObjectContext', () => {
  it('returns null when the cursor is not inside an object', () => {
    expect(findCursorObjectContext('"hello"', 7)).toBeNull();
  });

  it('reports an empty path at the root object', () => {
    const text = '{ name: "a",  }';
    const ctx = findCursorObjectContext(text, text.length - 2);
    expect(ctx?.path).toEqual([]);
    expect(ctx?.usedKeys.has('name')).toBe(true);
  });

  it('reports the nested path when the cursor is inside a nested object', () => {
    const text = '{ meta: {  } }';
    const cursor = text.indexOf('{ ', 1) + 2; // just after the inner "{ "
    const ctx = findCursorObjectContext(text, cursor);
    expect(ctx?.path).toEqual(['meta']);
  });

  it('scopes usedKeys to the current object only', () => {
    const text = '{ a: { b: 1, c<cursor> } }';
    const cursor = text.indexOf('<cursor>');
    const ctx = findCursorObjectContext(text.replace('<cursor>', ''), cursor);
    expect(ctx?.path).toEqual(['a']);
    expect(ctx?.usedKeys.has('b')).toBe(true);
    // `a` belongs to the outer scope, not this one
    expect(ctx?.usedKeys.has('a')).toBe(false);
  });

  it('records shorthand keys', () => {
    const text = '{ name, age<cursor> }';
    const cursor = text.indexOf('<cursor>');
    const ctx = findCursorObjectContext(text.replace('<cursor>', ''), cursor);
    expect(ctx?.usedKeys.has('name')).toBe(true);
  });

  it('detects a value slot after `key: "`', () => {
    const text = '{ kind: "em';
    const ctx = findCursorObjectContext(text, text.length);
    expect(ctx?.valueSlot).toEqual({ key: 'kind', quote: '"', partial: 'em' });
  });

  it('detects a value slot after `key: ` with no quote', () => {
    const text = '{ count: ';
    const ctx = findCursorObjectContext(text, text.length);
    expect(ctx?.valueSlot).toEqual({ key: 'count', quote: '', partial: '' });
  });

  it('narrows to a nested value slot inside a nested object', () => {
    const text = '{ meta: { role: "ad';
    const ctx = findCursorObjectContext(text, text.length);
    expect(ctx?.path).toEqual(['meta']);
    expect(ctx?.valueSlot).toEqual({ key: 'role', quote: '"', partial: 'ad' });
  });
});
