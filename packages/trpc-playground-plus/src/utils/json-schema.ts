/**
 * Shared JSON-Schema navigation primitives.
 *
 * These are the single source of truth for union/discriminant handling, used by
 * BOTH the validator (`zod-validator.ts`) and the editor autocomplete
 * (`CodeEditor.tsx`) so the two can never drift apart again. Pure functions only
 * — no React, no DOM.
 */

/** Literal value of a schema that represents a single literal (const or single-value enum). */
export function singleLiteral(prop: any): any {
  if (!prop) return undefined;
  if (prop.const !== undefined) return prop.const;
  if (Array.isArray(prop.enum) && prop.enum.length === 1) return prop.enum[0];
  return undefined;
}

/** Keep only the object members of an `anyOf` (the ones we can validate / complete). */
export function objectMembers(anyOf: any[] | undefined): any[] {
  if (!Array.isArray(anyOf)) return [];
  return anyOf.filter((m: any) => m && m.type === 'object' && m.properties);
}

/** Discriminant key of a union: a property holding a single literal in every member. */
export function findDiscriminantKey(members: any[]): string | null {
  const keys = members[0]?.properties ? Object.keys(members[0].properties) : [];
  for (const key of keys) {
    if (members.every((m) => singleLiteral(m.properties?.[key]) !== undefined)) return key;
  }
  return null;
}

/** The distinct literal values a discriminant can take across all members. */
export function discriminantLiterals(members: any[], key: string): any[] {
  return Array.from(new Set(members.map((m) => singleLiteral(m.properties?.[key]))));
}

/** Select the union member whose discriminant literal strictly equals `value`. */
export function narrowUnionByLiteral(members: any[], key: string, value: any): any | null {
  return members.find((m) => singleLiteral(m.properties?.[key]) === value) ?? null;
}

/**
 * Synthetic object schema that offers ONLY the discriminant, with every variant's
 * literal as a value option. Used to drive "pick the discriminant first" completion
 * at any depth (before a variant has been chosen).
 */
export function unionValueSchema(members: any[], discriminant: string): any {
  return {
    type: 'object',
    properties: { [discriminant]: { enum: discriminantLiterals(members, discriminant) } },
    required: [discriminant],
  };
}

/**
 * Merge non-discriminated union object members into a single object schema:
 * properties are unioned, differing literals on the same key collapse into an enum,
 * and `required` keeps only keys required in every member.
 * (Autocomplete-only: the validator handles non-discriminated unions by trying each member.)
 */
export function mergeObjectSchemas(members: any[]): any {
  const properties: Record<string, any> = {};
  const requiredCounts: Record<string, number> = {};
  for (const member of members) {
    for (const [key, value] of Object.entries<any>(member.properties)) {
      const existing = properties[key];
      if (!existing) {
        properties[key] = value;
      } else {
        const existingLiterals = existing.const !== undefined ? [existing.const] : existing.enum;
        const valueLiterals = value.const !== undefined ? [value.const] : value.enum;
        if (Array.isArray(existingLiterals) && Array.isArray(valueLiterals)) {
          properties[key] = { enum: Array.from(new Set([...existingLiterals, ...valueLiterals])) };
        }
      }
      if ((member.required || []).includes(key)) requiredCounts[key] = (requiredCounts[key] || 0) + 1;
    }
  }
  const required = Object.keys(requiredCounts).filter((key) => requiredCounts[key] === members.length);
  return { type: 'object', properties, required };
}

/**
 * Given a union node's members, decide the effective object schema for completion:
 * - discriminant chosen (lookup returns a matching literal) → the matching member
 * - discriminant not chosen yet → `unionValueSchema` (offer only the discriminant)
 * - non-discriminated union → merged superset
 * Returns `null` when there are no usable object members.
 */
export function resolveUnionObjectSchema(
  members: any[],
  getDiscriminantValue?: DiscriminantLookup,
  atPath: string[] = [],
): any | null {
  if (members.length === 0) return null;
  const discriminant = findDiscriminantKey(members);
  if (discriminant) {
    const value = getDiscriminantValue?.(members, discriminant, atPath);
    if (value !== undefined) {
      const chosen = narrowUnionByLiteral(members, discriminant, value);
      if (chosen) return chosen;
    }
    return unionValueSchema(members, discriminant);
  }
  return mergeObjectSchemas(members);
}

/** Supplies the already-known discriminant value at a given union node (from data or typed text). */
export type DiscriminantLookup = (members: any[], key: string, atPath: string[]) => any;

/**
 * Descend `path` through a JSON schema, narrowing unions at each step, and return
 * the effective object schema at the destination (or `null` if it can't be resolved).
 *
 * `getDiscriminantValue` lets each caller decide how to read a discriminant value:
 * the validator walks the parsed data in parallel; the autocomplete parses it out
 * of the typed text. This is the single shared descent that keeps nested
 * validation and nested completion in lock-step.
 */
export function resolveSchemaAtPath(
  root: any,
  path: string[],
  getDiscriminantValue?: DiscriminantLookup,
): any | null {
  let current = root;
  for (let i = 0; i <= path.length; i++) {
    if (!current) return null;

    // Collapse a union node to its effective object schema before stepping further.
    if (Array.isArray(current.anyOf)) {
      current = resolveUnionObjectSchema(objectMembers(current.anyOf), getDiscriminantValue, path.slice(0, i));
      if (!current) return null;
    }

    if (i === path.length) break; // reached the destination node

    if (current.type === 'object' && current.properties) {
      current = current.properties[path[i]];
    } else {
      return null; // path goes deeper than the schema allows
    }
  }

  return current ?? null;
}
