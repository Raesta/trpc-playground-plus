import { describe, expect, it } from 'vitest';
import { parseCodeForTrpcCalls } from './code-parser';

describe('parseCodeForTrpcCalls — call detection', () => {
  it('detects a query call', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.getUser.query("42")');
    expect(calls).toHaveLength(1);
    expect(calls[0].procedure).toBe('getUser');
    expect(calls[0].type).toBe('query');
    expect(calls[0].args).toBe('42');
  });

  it('detects a mutation call (mutate → type "mutation")', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.create.mutate("x")');
    expect(calls[0].type).toBe('mutation');
  });

  it('resolves a nested procedure path', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.user.getById.query("1")');
    expect(calls[0].procedure).toBe('user.getById');
  });

  it('parses multiple calls in one snippet', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.query("1")\ntrpc.b.mutate("2")');
    expect(calls.map((c) => c.procedure)).toEqual(['a', 'b']);
    expect(calls.map((c) => c.type)).toEqual(['query', 'mutation']);
  });
});

describe('parseCodeForTrpcCalls — argument parsing', () => {
  it('parses primitive string and number args', () => {
    expect(parseCodeForTrpcCalls("trpc.a.query('hi')").calls[0].args).toBe('hi');
    expect(parseCodeForTrpcCalls('trpc.a.query(42)').calls[0].args).toBe(42);
  });

  it('parses a flat object literal', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ name: "a", age: 2, ok: true, n: null })');
    expect(calls[0].args).toEqual({ name: 'a', age: 2, ok: true, n: null });
  });

  it('parses a nested object literal', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ user: { name: "a" }, active: true })');
    expect(calls[0].args).toEqual({ user: { name: 'a' }, active: true });
  });

  it('expands shorthand properties to a JS-expression placeholder', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ name, age })');
    expect(calls[0].args).toEqual({ name: '__JS_EXPR__name', age: '__JS_EXPR__age' });
  });

  it('marks JS expression values with the __JS_EXPR__ prefix', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ when: new Date() })');
    expect(calls[0].args).toEqual({ when: '__JS_EXPR__new Date()' });
  });

  it('parses arrays when the whole object is valid JSON', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ items: [1, 2, 3] })');
    expect(calls[0].args).toEqual({ items: [1, 2, 3] });
  });

  it('parses arrays even when the manual parser kicks in (JS expression present)', () => {
    // A JS-expression value forces the manual parser; arrays must still be parsed,
    // not left as raw strings (ROADMAP §1 — now fixed).
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ tags: [1, 2], when: new Date() })');
    expect(calls[0].args.tags).toEqual([1, 2]);
    expect(calls[0].args.when).toBe('__JS_EXPR__new Date()');
  });

  it('parses an array of objects (manual path)', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ users: [{ name: "a" }, { name: "b" }], x: new Date() })');
    expect(calls[0].args.users).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('parses nested arrays', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ grid: [[1, 2], [3, 4]], x: new Date() })');
    expect(calls[0].args.grid).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('respects commas inside array string elements', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ tags: ["a, b", "c"], x: new Date() })');
    expect(calls[0].args.tags).toEqual(['a, b', 'c']);
  });

  it('marks JS expressions inside arrays with the __JS_EXPR__ prefix', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ dates: [new Date()], x: new Date() })');
    expect(calls[0].args.dates).toEqual(['__JS_EXPR__new Date()']);
  });

  it('parses an empty array', () => {
    const { calls } = parseCodeForTrpcCalls('trpc.a.mutate({ tags: [], x: new Date() })');
    expect(calls[0].args.tags).toEqual([]);
  });
});

describe('parseCodeForTrpcCalls — errors & positions', () => {
  it('reports unbalanced parentheses', () => {
    const { calls, errors } = parseCodeForTrpcCalls('trpc.a.query("hi"');
    expect(calls).toHaveLength(0);
    expect(errors[0].message).toContain('Unbalanced parentheses');
  });

  it('computes line & column of a call on the second line', () => {
    const { calls } = parseCodeForTrpcCalls('const x = 1;\ntrpc.echo.query("hi")');
    expect(calls[0].position.line).toBe(2);
    expect(calls[0].position.column).toBe(1);
  });
});
