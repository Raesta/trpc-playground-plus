import { describe, expect, it } from 'vitest';
import {
  discriminantLiterals,
  findDiscriminantKey,
  mergeObjectSchemas,
  narrowUnionByLiteral,
  objectMembers,
  resolveSchemaAtPath,
  resolveUnionObjectSchema,
  singleLiteral,
  unionValueSchema,
} from './json-schema';

const emailMember = {
  type: 'object',
  properties: { kind: { type: 'string', const: 'email' }, to: { type: 'string' } },
  required: ['kind', 'to'],
  additionalProperties: false,
};
const smsMember = {
  type: 'object',
  properties: { kind: { type: 'string', const: 'sms' }, phone: { type: 'string' } },
  required: ['kind', 'phone'],
  additionalProperties: false,
};
const members = [emailMember, smsMember];

describe('singleLiteral', () => {
  it('reads a const', () => expect(singleLiteral({ const: 'x' })).toBe('x'));
  it('reads a single-value enum', () => expect(singleLiteral({ enum: ['only'] })).toBe('only'));
  it('returns undefined for a multi-value enum', () => expect(singleLiteral({ enum: ['a', 'b'] })).toBeUndefined());
  it('returns undefined for nothing', () => expect(singleLiteral(undefined)).toBeUndefined());
});

describe('objectMembers', () => {
  it('keeps only object members', () => {
    expect(objectMembers([emailMember, { type: 'string' }, null])).toEqual([emailMember]);
  });
  it('returns [] for a non-array', () => expect(objectMembers(undefined)).toEqual([]));
});

describe('findDiscriminantKey', () => {
  it('finds the key that is a literal in every member', () => {
    expect(findDiscriminantKey(members)).toBe('kind');
  });
  it('returns null when there is no common literal key', () => {
    const a = { properties: { x: { type: 'string' } } };
    const b = { properties: { x: { type: 'string' } } };
    expect(findDiscriminantKey([a, b])).toBeNull();
  });
});

describe('discriminantLiterals', () => {
  it('lists the distinct literals', () => {
    expect(discriminantLiterals(members, 'kind')).toEqual(['email', 'sms']);
  });
});

describe('narrowUnionByLiteral', () => {
  it('selects the matching member (strict ===)', () => {
    expect(narrowUnionByLiteral(members, 'kind', 'sms')).toBe(smsMember);
  });
  it('returns null on no match', () => {
    expect(narrowUnionByLiteral(members, 'kind', 'fax')).toBeNull();
  });
  it('supports non-string discriminants', () => {
    const one = { properties: { v: { const: 1 } } };
    const two = { properties: { v: { const: 2 } } };
    expect(narrowUnionByLiteral([one, two], 'v', 2)).toBe(two);
  });
});

describe('unionValueSchema', () => {
  it('offers only the discriminant with every literal', () => {
    expect(unionValueSchema(members, 'kind')).toEqual({
      type: 'object',
      properties: { kind: { enum: ['email', 'sms'] } },
      required: ['kind'],
    });
  });
});

describe('mergeObjectSchemas', () => {
  it('unions properties and intersects required', () => {
    const merged = mergeObjectSchemas(members);
    expect(Object.keys(merged.properties).sort()).toEqual(['kind', 'phone', 'to']);
    // `kind` required in both members → kept; `to`/`phone` only in one → dropped
    expect(merged.required).toEqual(['kind']);
  });
  it('collapses differing literals on the same key into an enum', () => {
    const merged = mergeObjectSchemas(members);
    expect(merged.properties.kind).toEqual({ enum: ['email', 'sms'] });
  });
});

describe('resolveUnionObjectSchema', () => {
  it('narrows to the chosen variant when the discriminant is known', () => {
    expect(resolveUnionObjectSchema(members, () => 'sms')).toBe(smsMember);
  });
  it('offers only the discriminant when not yet chosen', () => {
    expect(resolveUnionObjectSchema(members, () => undefined)).toEqual(unionValueSchema(members, 'kind'));
  });
  it('merges a non-discriminated union', () => {
    const a = { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] };
    const b = { type: 'object', properties: { y: { type: 'number' } }, required: ['y'] };
    const merged = resolveUnionObjectSchema([a, b]);
    expect(Object.keys(merged.properties).sort()).toEqual(['x', 'y']);
  });
});

describe('resolveSchemaAtPath', () => {
  const root = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      meta: {
        type: 'object',
        properties: { tag: { type: 'string' }, inner: { type: 'object', properties: { count: { type: 'number' } } } },
      },
      config: { anyOf: members },
    },
  };

  it('returns the root object for an empty path', () => {
    expect(resolveSchemaAtPath(root, [])).toBe(root);
  });
  it('descends into a nested object', () => {
    expect(resolveSchemaAtPath(root, ['meta'])).toBe(root.properties.meta);
  });
  it('descends two levels', () => {
    expect(resolveSchemaAtPath(root, ['meta', 'inner'])).toBe(root.properties.meta.properties.inner);
  });
  it('narrows a nested union using the lookup', () => {
    const chosen = resolveSchemaAtPath(root, ['config'], () => 'email');
    expect(chosen).toBe(emailMember);
  });
  it('offers only the discriminant for an unresolved nested union', () => {
    const offered = resolveSchemaAtPath(root, ['config'], () => undefined);
    expect(offered).toEqual(unionValueSchema(members, 'kind'));
  });
  it('returns null when the path goes deeper than the schema', () => {
    expect(resolveSchemaAtPath(root, ['name', 'nope'])).toBeNull();
  });
});
