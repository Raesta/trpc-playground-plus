import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RouterSchema } from '../types';
import type { TrpcCall } from './code-parser';
import {
  clearValidationCache,
  resolveVariableType,
  validateCode,
  validateCodeWithCache,
  validateTrpcCall,
} from './zod-validator';

// Build a JSON Schema exactly like the Fastify adapter does (adapters/fastify.ts).
const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { unrepresentable: 'any' });

const makeCall = (
  procedure: string,
  type: 'query' | 'mutation',
  args: any,
  rawCall = `trpc.${procedure}.${type === 'mutation' ? 'mutate' : 'query'}(...)`,
): TrpcCall => ({
  procedure,
  type,
  args,
  position: { start: 0, end: rawCall.length, line: 1, column: 1 },
  rawCall,
});

describe('validateTrpcCall — routing', () => {
  const schema: RouterSchema = {
    getUser: { type: 'query', inputSchema: jsonSchema(z.string()) },
    user: {
      type: 'router',
      children: {
        getById: { type: 'query', inputSchema: jsonSchema(z.string()) },
      },
    },
    ping: { type: 'query' },
  };

  it('flags an unknown procedure', () => {
    const res = validateTrpcCall(makeCall('nope', 'query', 'x'), schema);
    expect(res.isValid).toBe(false);
    expect(res.errors[0].code).toBe('procedure_not_found');
  });

  it('resolves nested routers', () => {
    const res = validateTrpcCall(makeCall('user.getById', 'query', 'abc'), schema);
    expect(res.isValid).toBe(true);
  });

  it('flags a wrong call type (query called as mutation)', () => {
    const res = validateTrpcCall(makeCall('getUser', 'mutation', 'x'), schema);
    expect(res.errors.some((e) => e.code === 'wrong_call_type')).toBe(true);
  });

  it('warns when args are passed to a procedure with no input', () => {
    const res = validateTrpcCall(makeCall('ping', 'query', { a: 1 }), schema);
    expect(res.isValid).toBe(true);
    expect(res.warnings[0].code).toBe('unexpected_input');
  });
});

describe('validateTrpcCall — object input', () => {
  const schema: RouterSchema = {
    create: {
      type: 'mutation',
      inputSchema: jsonSchema(
        z.object({
          name: z.string(),
          age: z.number().optional(),
          role: z.enum(['admin', 'user']),
          active: z.boolean(),
          meta: z.object({ tag: z.string() }).optional(),
        }),
      ),
    },
  };

  it('accepts a valid object', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { name: 'Jo', role: 'admin', active: true }),
      schema,
    );
    expect(res.isValid).toBe(true);
  });

  it('flags an unrecognized key', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { name: 'Jo', role: 'admin', active: true, oops: 1 }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'unrecognized_keys')).toBe(true);
  });

  it('flags a missing required property', () => {
    const res = validateTrpcCall(makeCall('create', 'mutation', { role: 'admin', active: true }), schema);
    const err = res.errors.find((e) => e.path?.[0] === 'name');
    expect(err?.code).toBe('invalid_type');
    // A missing required prop currently surfaces as a generic "Type mismatch"
    // with the detail in expected/received (defined vs undefined).
    expect(err?.expected).toBe('defined');
    expect(err?.received).toBe('undefined');
  });

  it('flags a string/number/boolean type mismatch with expected & received', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { name: 123, role: 'admin', active: 'yes' }),
      schema,
    );
    const nameErr = res.errors.find((e) => e.path?.[0] === 'name');
    expect(nameErr?.code).toBe('invalid_type');
    expect(nameErr?.expected).toBe('string');
    expect(nameErr?.received).toBe('number');
    const activeErr = res.errors.find((e) => e.path?.[0] === 'active');
    expect(activeErr?.expected).toBe('boolean');
  });

  it('flags an object type mismatch (primitive given for object prop)', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { name: 'Jo', role: 'admin', active: true, meta: 'nope' }),
      schema,
    );
    const err = res.errors.find((e) => e.path?.[0] === 'meta');
    expect(err?.code).toBe('invalid_type');
    expect(err?.expected).toBe('object');
  });

  it('flags an invalid enum value', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { name: 'Jo', role: 'ghost', active: true }),
      schema,
    );
    const err = res.errors.find((e) => e.path?.[0] === 'role');
    expect(err?.code).toBe('invalid_enum_value');
    expect(err?.expected).toContain('"admin"');
  });
});

describe('validateTrpcCall — discriminated union', () => {
  // Mirrors examples/fastify-app/src/server.ts `sendNotification`.
  const schema: RouterSchema = {
    notify: {
      type: 'mutation',
      inputSchema: jsonSchema(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('email'), to: z.string(), subject: z.string() }),
          z.object({ type: z.literal('sms'), phoneNumber: z.string() }),
          z.object({ type: z.literal('push'), deviceToken: z.string(), badge: z.number().optional() }),
        ]),
      ),
    },
  };

  it('accepts a valid variant', () => {
    const res = validateTrpcCall(
      makeCall('notify', 'mutation', { type: 'email', to: 'a@b.co', subject: 'hi' }),
      schema,
    );
    expect(res.isValid).toBe(true);
  });

  it('flags a missing discriminant', () => {
    const res = validateTrpcCall(makeCall('notify', 'mutation', { to: 'a@b.co' }), schema);
    const err = res.errors.find((e) => e.path?.[0] === 'type');
    expect(err?.code).toBe('invalid_type');
    expect(err?.expected).toBe('defined');
    expect(err?.received).toBe('undefined');
  });

  it('flags an unknown discriminant value with the allowed set', () => {
    const res = validateTrpcCall(makeCall('notify', 'mutation', { type: 'fax' }), schema);
    const err = res.errors.find((e) => e.path?.[0] === 'type');
    expect(err?.code).toBe('invalid_enum_value');
    expect(err?.expected).toBe('"email" | "sms" | "push"');
    expect(err?.received).toBe('"fax"');
  });

  it('flags a field that belongs to another variant as unrecognized', () => {
    const res = validateTrpcCall(
      makeCall('notify', 'mutation', { type: 'email', to: 'a@b.co', subject: 'hi', phoneNumber: '123' }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'unrecognized_keys' && e.path?.[0] === 'phoneNumber')).toBe(true);
  });

  it('skips strict checks when the discriminant is a JS expression / variable', () => {
    const res = validateTrpcCall(makeCall('notify', 'mutation', { type: '__JS_EXPR__someVar' }), schema);
    expect(res.isValid).toBe(true);
  });
});

describe('validateTrpcCall — variables', () => {
  const schema: RouterSchema = {
    echo: { type: 'query', inputSchema: jsonSchema(z.string()) },
    create: {
      type: 'mutation',
      inputSchema: jsonSchema(z.object({ age: z.number() })),
    },
  };

  it('flags a top-level variable whose type mismatches', () => {
    const res = validateTrpcCall(makeCall('echo', 'query', 'myVar'), schema, new Map([['myVar', 'number']]));
    const err = res.errors[0];
    expect(err.code).toBe('invalid_type');
    // The variable name is no longer in the message (generic "Type mismatch");
    // the type detail lives in expected/received.
    expect(err.expected).toBe('string');
    expect(err.received).toBe('number');
  });

  it('accepts a top-level variable of the right type', () => {
    const res = validateTrpcCall(makeCall('echo', 'query', 'myVar'), schema, new Map([['myVar', 'string']]));
    expect(res.isValid).toBe(true);
  });

  it('flags a property JS-expression bound to a known variable of the wrong type', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { age: '__JS_EXPR__myVar' }),
      schema,
      new Map([['myVar', 'string']]),
    );
    const err = res.errors.find((e) => e.path?.[0] === 'age');
    expect(err?.code).toBe('invalid_type');
    expect(err?.received).toBe('string');
  });

  it('reports an unknown property JS-expression as received "expression"', () => {
    const res = validateTrpcCall(
      makeCall('create', 'mutation', { age: '__JS_EXPR__computeAge()' }),
      schema,
    );
    const err = res.errors.find((e) => e.path?.[0] === 'age');
    expect(err?.code).toBe('invalid_type');
    // received is the raw expression once formatted for display
    expect(err?.received).toBe('computeAge()');
  });
});

describe('resolveVariableType', () => {
  it.each([
    ['', 'unknown'],
    ['123', 'number'],
    ['"x"', 'string'],
    ['true', 'boolean'],
    ['null', 'null'],
    ['[1, 2]', 'array'],
    ['{"a":1}', 'object'],
    ['just text', 'string'],
  ])('resolves %j to %s', (input, expected) => {
    expect(resolveVariableType(input)).toBe(expected);
  });
});

describe('validateCodeWithCache', () => {
  const schema: RouterSchema = { echo: { type: 'query', inputSchema: jsonSchema(z.string()) } };
  const call = makeCall('echo', 'query', 'hi');

  it('returns the cached instance on identical input and rebuilds after clear', () => {
    clearValidationCache();
    const a = validateCodeWithCache('code', [call], schema);
    const b = validateCodeWithCache('code', [call], schema);
    expect(a).toBe(b);

    clearValidationCache();
    const c = validateCodeWithCache('code', [call], schema);
    expect(c).not.toBe(a);
    expect(c).toEqual(a);
  });
});

describe('validateCode — aggregation', () => {
  const schema: RouterSchema = {
    echo: { type: 'query', inputSchema: jsonSchema(z.string()) },
  };

  it('aggregates errors across multiple calls', () => {
    const res = validateCode([makeCall('echo', 'query', 'ok'), makeCall('missing', 'query', 'x')], schema);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === 'procedure_not_found')).toBe(true);
  });
});

describe('validateTrpcCall — nested objects (recursive)', () => {
  const schema: RouterSchema = {
    save: {
      type: 'mutation',
      inputSchema: jsonSchema(
        z.object({
          name: z.string(),
          meta: z.object({
            tag: z.string(),
            role: z.enum(['admin', 'user']),
            inner: z.object({ count: z.number() }).optional(),
          }),
          config: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('a'), a: z.string() }),
            z.object({ kind: z.literal('b'), b: z.number() }),
          ]),
        }),
      ),
    },
  };

  const valid = {
    name: 'Jo',
    meta: { tag: 't', role: 'admin' as const },
    config: { kind: 'a' as const, a: 'x' },
  };

  it('accepts a valid deeply-nested object', () => {
    expect(validateTrpcCall(makeCall('save', 'mutation', valid), schema).isValid).toBe(true);
  });

  it('flags a nested type mismatch with a full path', () => {
    const res = validateTrpcCall(makeCall('save', 'mutation', { ...valid, meta: { ...valid.meta, tag: 123 } }), schema);
    const err = res.errors.find((e) => e.code === 'invalid_type' && e.path?.join('.') === 'meta.tag');
    expect(err).toBeDefined();
    expect(err?.expected).toBe('string');
    expect(err?.received).toBe('number');
  });

  it('flags a missing nested required property', () => {
    const res = validateTrpcCall(makeCall('save', 'mutation', { ...valid, meta: { role: 'admin' } }), schema);
    expect(res.errors.some((e) => e.path?.join('.') === 'meta.tag' && e.received === 'undefined')).toBe(true);
  });

  it('flags an unrecognized nested key with a full path', () => {
    const res = validateTrpcCall(
      makeCall('save', 'mutation', { ...valid, meta: { ...valid.meta, oops: 1 } }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'unrecognized_keys' && e.path?.join('.') === 'meta.oops')).toBe(true);
  });

  it('flags a nested enum violation with a full path', () => {
    const res = validateTrpcCall(
      makeCall('save', 'mutation', { ...valid, meta: { ...valid.meta, role: 'ghost' } }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'invalid_enum_value' && e.path?.join('.') === 'meta.role')).toBe(true);
  });

  it('validates a deeper (2-level) nested object', () => {
    const res = validateTrpcCall(
      makeCall('save', 'mutation', { ...valid, meta: { ...valid.meta, inner: { count: 'nope' } } }),
      schema,
    );
    expect(res.errors.some((e) => e.path?.join('.') === 'meta.inner.count' && e.expected === 'number')).toBe(true);
  });

  it('narrows a nested discriminated union and flags a wrong-variant field', () => {
    const res = validateTrpcCall(
      makeCall('save', 'mutation', { ...valid, config: { kind: 'a', a: 'x', b: 5 } }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'unrecognized_keys' && e.path?.join('.') === 'config.b')).toBe(true);
  });

  it('flags an invalid discriminant value on a nested union', () => {
    const res = validateTrpcCall(
      makeCall('save', 'mutation', { ...valid, config: { kind: 'z' } }),
      schema,
    );
    expect(res.errors.some((e) => e.code === 'invalid_enum_value' && e.path?.join('.') === 'config.kind')).toBe(true);
  });
});

describe('validateTrpcCall — arrays', () => {
  const schema: RouterSchema = {
    tagIt: { type: 'mutation', inputSchema: jsonSchema(z.object({ tags: z.array(z.string()) })) },
    addUsers: {
      type: 'mutation',
      inputSchema: jsonSchema(z.object({ users: z.array(z.object({ name: z.string() })) })),
    },
  };

  it('accepts a valid array of primitives', () => {
    const res = validateTrpcCall(makeCall('tagIt', 'mutation', { tags: ['a', 'b'] }), schema);
    expect(res.isValid).toBe(true);
  });

  it('flags a wrong-typed item with its index in the path', () => {
    const res = validateTrpcCall(makeCall('tagIt', 'mutation', { tags: ['a', 123] }), schema);
    expect(res.errors.some((e) => e.code === 'invalid_type' && e.path?.join('.') === 'tags.1' && e.expected === 'string')).toBe(
      true,
    );
  });

  it('flags a value that should be an array but is not', () => {
    const res = validateTrpcCall(makeCall('tagIt', 'mutation', { tags: 'nope' }), schema);
    expect(res.errors.some((e) => e.code === 'invalid_type' && e.path?.join('.') === 'tags' && e.expected === 'array')).toBe(true);
  });

  it('recurses into an array of objects and reports a nested path', () => {
    const res = validateTrpcCall(makeCall('addUsers', 'mutation', { users: [{ name: 'ok' }, { name: 42 }] }), schema);
    expect(res.errors.some((e) => e.path?.join('.') === 'users.1.name' && e.expected === 'string')).toBe(true);
  });

  it('highlights the offending array item, not the first one', () => {
    const rawCall = 'trpc.addUsers.mutate({ users: [{ name: "a" }, { name: 42 }] })';
    const res = validateTrpcCall(
      makeCall('addUsers', 'mutation', { users: [{ name: 'a' }, { name: 42 }] }, rawCall),
      schema,
    );
    const err = res.errors.find((e) => e.path?.join('.') === 'users.1.name');
    expect(err).toBeDefined();
    // position offsets index directly into rawCall (call.position.start === 0).
    expect(rawCall.slice(err!.position.start, err!.position.end)).toBe('42');
  });
});

// --- Known gaps tracked in ROADMAP.md (§1) — pending deeper validation ---
describe('validation gaps (ROADMAP §1)', () => {
  it.todo('enforces constraints (min/max, minLength/maxLength, regex, email)');
  it.todo('validates unions whose members are not objects');
});
