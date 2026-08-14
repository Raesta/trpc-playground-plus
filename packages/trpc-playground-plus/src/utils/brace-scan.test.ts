import { describe, expect, it } from 'vitest';
import { findCursorObjectContext, findKeySpanAtPath, findValueSpanAtPath, scanBalanced, splitTopLevel } from './brace-scan';

describe('splitTopLevel', () => {
  it('splits a flat list', () => {
    expect(splitTopLevel('1, 2, 3')).toEqual(['1', '2', '3']);
  });

  it('ignores commas inside strings', () => {
    expect(splitTopLevel('"a, b", "c"')).toEqual(['"a, b"', '"c"']);
  });

  it('ignores commas inside nested objects and arrays', () => {
    expect(splitTopLevel('{ a: 1, b: 2 }, [3, 4], 5')).toEqual(['{ a: 1, b: 2 }', '[3, 4]', '5']);
  });

  it('ignores commas inside parentheses', () => {
    expect(splitTopLevel('foo(1, 2), bar')).toEqual(['foo(1, 2)', 'bar']);
  });

  it('drops a trailing comma', () => {
    expect(splitTopLevel('1, 2, ')).toEqual(['1', '2']);
  });

  it('returns an empty array for empty content', () => {
    expect(splitTopLevel('')).toEqual([]);
    expect(splitTopLevel('   ')).toEqual([]);
  });
});

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

describe('findValueSpanAtPath', () => {
  const call = 'trpc.a.mutate({ name: "x", meta: { tag: 7 }, when: new Date(), users: [{ name: "a" }, { name: 42 }] })';
  const at = (path: string[]) => {
    const span = findValueSpanAtPath(call, path);
    return span ? call.slice(span.start, span.end) : null;
  };

  it('locates a top-level value', () => expect(at(['name'])).toBe('"x"'));
  it('locates a nested value', () => expect(at(['meta', 'tag'])).toBe('7'));
  it('locates a JS expression value (parens kept whole)', () => expect(at(['when'])).toBe('new Date()'));
  it('locates a whole array element', () => expect(at(['users', '1'])).toBe('{ name: 42 }'));
  it('locates a value inside a specific array element', () => expect(at(['users', '1', 'name'])).toBe('42'));
  it('does not confuse the first array element with the second', () => expect(at(['users', '0', 'name'])).toBe('"a"'));
  it('returns null for a missing key', () => expect(findValueSpanAtPath(call, ['nope'])).toBeNull());
  it('returns null for an out-of-range index', () => expect(findValueSpanAtPath(call, ['users', '5'])).toBeNull());
});

describe('findKeySpanAtPath', () => {
  const at = (call: string, path: string[]) => {
    const span = findKeySpanAtPath(call, path);
    return span ? call.slice(span.start, span.end) : null;
  };

  it('locates a top-level key token', () => expect(at('trpc.a.mutate({ oops: 1 })', ['oops'])).toBe('oops'));
  it('locates a nested key token', () => expect(at('trpc.a.mutate({ meta: { oops: 1 } })', ['meta', 'oops'])).toBe('oops'));
  it('locates a key inside an array element', () =>
    expect(at('trpc.a.mutate({ users: [{ name: "a" }, { oops: 1 }] })', ['users', '1', 'oops'])).toBe('oops'));
});
