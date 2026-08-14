import { describe, expect, it } from 'vitest';
import { type CallRange, findTrpcCalls, pickCallAtCursor } from './run-keymap';

const calls: CallRange[] = [
  { start: 0, end: 10, code: 'a' },
  { start: 20, end: 35, code: 'b' },
];

describe('pickCallAtCursor', () => {
  it('returns null when there are no calls', () => {
    expect(pickCallAtCursor([], 5)).toBeNull();
  });

  it('picks the call whose range contains the cursor', () => {
    expect(pickCallAtCursor(calls, 5)?.code).toBe('a');
    expect(pickCallAtCursor(calls, 25)?.code).toBe('b');
  });

  it('includes the range boundaries', () => {
    expect(pickCallAtCursor(calls, 0)?.code).toBe('a');
    expect(pickCallAtCursor(calls, 10)?.code).toBe('a');
    expect(pickCallAtCursor(calls, 35)?.code).toBe('b');
  });

  it('picks the call above when the cursor is between two calls', () => {
    expect(pickCallAtCursor(calls, 15)?.code).toBe('a');
  });

  it('falls back to the first call when the cursor is before every call', () => {
    expect(pickCallAtCursor(calls, -5)?.code).toBe('a');
  });

  it('picks the last call when the cursor is after every call', () => {
    expect(pickCallAtCursor(calls, 100)?.code).toBe('b');
  });
});

describe('findTrpcCalls', () => {
  it('finds a single top-level call with its range', () => {
    const text = 'trpc.getUser.query("42")';
    const found = findTrpcCalls(text);
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('trpc.getUser.query("42")');
    expect(found[0].start).toBe(0);
    expect(found[0].end).toBe(text.length);
  });

  it('finds multiple calls across lines', () => {
    const found = findTrpcCalls('trpc.a.query(1)\ntrpc.b.mutate(2)');
    expect(found.map((c) => c.code)).toEqual(['trpc.a.query(1)', 'trpc.b.mutate(2)']);
  });

  it('handles nested parentheses in arguments', () => {
    const found = findTrpcCalls('trpc.a.mutate({ when: new Date() })');
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('trpc.a.mutate({ when: new Date() })');
  });

  it('ignores calls that are not at the start of a line', () => {
    expect(findTrpcCalls('const x = trpc.a.query(1)')).toHaveLength(0);
  });
});
