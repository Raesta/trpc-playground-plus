import type { RouterSchema } from '../types';
import type { TrpcCall } from './code-parser';
import { findKeySpanAtPath, findValueSpanAtPath } from './brace-scan';
import { discriminantLiterals, findDiscriminantKey, narrowUnionByLiteral, objectMembers } from './json-schema';

export interface ValidationError {
  message: string;
  path?: string[];
  code: string;
  /** Structured type/value info for rich diagnostic rendering. */
  expected?: string;
  received?: string;
  position: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

function getProcedureSchema(
  procedure: string,
  schema: RouterSchema,
): { inputSchema?: any; outputSchema?: any; type?: string } | null {
  const pathSegments = procedure.split('.');
  let currentLevel = schema;

  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    const def = currentLevel[segment];

    if (!def || def.type !== 'router' || !def.children) {
      return null;
    }
    currentLevel = def.children;
  }

  const finalSegment = pathSegments[pathSegments.length - 1];
  const procedureDef = currentLevel[finalSegment];

  if (!procedureDef || procedureDef.type === 'router') {
    return null;
  }

  // At this point, procedureDef is necessarily a query or mutation
  const procDef = procedureDef as { type: 'query' | 'mutation'; inputSchema?: any; outputSchema?: any };

  return {
    inputSchema: procDef.inputSchema,
    outputSchema: procDef.outputSchema,
    type: procDef.type,
  };
}

/** Resolve the JSON type of a variable value (same logic as Variables.tsx resolveType) */
export function resolveVariableType(value: string): string {
  if (!value.trim()) return 'unknown';
  try {
    const parsed = JSON.parse(value);
    if (parsed === null) return 'null';
    if (Array.isArray(parsed)) return 'array';
    return typeof parsed; // 'string' | 'number' | 'boolean' | 'object'
  } catch {
    return 'string'; // fallback: raw string
  }
}

/**
 * Validation context threaded through the recursive validators.
 * `path` accumulates the JSON path so nested errors carry a full location
 * (e.g. `['meta', 'tag']`), which the linter uses for messages/highlighting.
 */
interface ValidationContext {
  variableTypes: Map<string, string>;
  path: string[];
}

/** Raw error shape produced by the validators, before `formatZodError` enriches it. */
interface RawError {
  code: string;
  message: string;
  path: string[];
  expected?: string;
  received?: string;
  [extra: string]: any;
}

const childContext = (ctx: ValidationContext, key: string): ValidationContext => ({
  variableTypes: ctx.variableTypes,
  path: [...ctx.path, key],
});

const typeOf = (value: any): string => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

/**
 * Central dispatcher: routes a value to the validator matching its schema.
 *
 * New schema constructs (arrays with `items`, string/number constraints,
 * records, …) should be added here as their own `validate*` branch — the
 * recursion and path handling then apply for free at any depth.
 */
function validateValue(data: any, schema: any, ctx: ValidationContext): RawError[] {
  if (!schema) return [];

  // Union / discriminated union: narrow before validating.
  if (Array.isArray(schema.anyOf)) return validateUnion(data, schema, ctx);

  // JS expression value (`{ x: someExpr() }` → `__JS_EXPR__someExpr()`).
  if (typeof data === 'string' && data.startsWith('__JS_EXPR__')) return validateExpression(data, schema, ctx);

  // Whole value is a known variable name (top-level `trpc.p.query(myVar)`).
  if (typeof data === 'string' && ctx.variableTypes.has(data)) return validateVariableRef(data, schema, ctx);

  if (schema.type === 'object') return validateObject(data, schema, ctx);

  if (schema.type === 'array') return validateArray(data, schema, ctx);

  if (
    schema.type === 'string' ||
    schema.type === 'number' ||
    schema.type === 'integer' ||
    schema.type === 'boolean' ||
    schema.type === 'null'
  ) {
    return validateScalar(data, schema, ctx);
  }

  // Other constructs (records, …) are not deep-validated yet (see ROADMAP §1);
  // still honour standalone enum/const schemas.
  return validateEnumConst(data, schema, ctx);
}

/** Build an `invalid_type` error at the current path. */
function typeMismatch(expected: string, received: string, ctx: ValidationContext, message?: string): RawError {
  return {
    code: 'invalid_type',
    message: message ?? `Expected ${expected}, but received ${received}`,
    path: ctx.path,
    expected,
    received,
  };
}

/** enum / const checks, independent of the value's base type. */
function validateEnumConst(data: any, schema: any, ctx: ValidationContext): RawError[] {
  const errors: RawError[] = [];
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    const allowed = schema.enum.map((v: any) => JSON.stringify(v)).join(' | ');
    errors.push({
      code: 'invalid_enum_value',
      message: `Expected one of ${allowed}, received ${JSON.stringify(data)}`,
      path: ctx.path,
      expected: allowed,
      received: JSON.stringify(data),
    });
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push({
      code: 'invalid_literal',
      message: `Expected ${JSON.stringify(schema.const)}, received ${JSON.stringify(data)}`,
      path: ctx.path,
      expected: JSON.stringify(schema.const),
      received: JSON.stringify(data),
    });
  }
  return errors;
}

/** Build a constraint-violation error (no expected/received chips: title-only). */
function constraint(ctx: ValidationContext, message: string): RawError {
  return { code: 'invalid_constraint', message, path: ctx.path };
}

/** Human label for a JSON Schema string `format` (used in constraint messages). */
function formatLabel(format: string | undefined): string | null {
  if (!format) return null;
  const labels: Record<string, string> = {
    email: 'email',
    uuid: 'UUID',
    uri: 'URL',
    'date-time': 'date-time',
    date: 'date',
    time: 'time',
    duration: 'duration',
  };
  return labels[format] ?? format;
}

/** String constraints: length bounds and pattern/format. */
function stringConstraints(value: string, schema: any, ctx: ValidationContext): RawError[] {
  const errors: RawError[] = [];
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    errors.push(constraint(ctx, `Too short: expected at least ${schema.minLength} character(s), but received ${value.length}`));
  }
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
    errors.push(constraint(ctx, `Too long: expected at most ${schema.maxLength} character(s), but received ${value.length}`));
  }
  // `pattern` encodes email/uuid/regex/date-time/… (some formats like `uri` have none).
  if (typeof schema.pattern === 'string') {
    let re: RegExp | null = null;
    try {
      re = new RegExp(schema.pattern);
    } catch {
      re = null;
    }
    if (re && !re.test(value)) {
      const label = formatLabel(schema.format);
      errors.push(constraint(ctx, label ? `Invalid ${label}` : 'Does not match the required pattern'));
    }
  }
  return errors;
}

/** Number constraints: inclusive/exclusive bounds and multipleOf. */
function numberConstraints(value: number, schema: any, ctx: ValidationContext): RawError[] {
  const errors: RawError[] = [];
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push(constraint(ctx, `Too small: expected ≥ ${schema.minimum}, but received ${value}`));
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    errors.push(constraint(ctx, `Too large: expected ≤ ${schema.maximum}, but received ${value}`));
  }
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    errors.push(constraint(ctx, `Too small: expected > ${schema.exclusiveMinimum}, but received ${value}`));
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    errors.push(constraint(ctx, `Too large: expected < ${schema.exclusiveMaximum}, but received ${value}`));
  }
  if (typeof schema.multipleOf === 'number' && value % schema.multipleOf !== 0) {
    errors.push(constraint(ctx, `Expected a multiple of ${schema.multipleOf}, but received ${value}`));
  }
  return errors;
}

/** string / number / integer / boolean primitives (+ constraints and any enum/const). */
function validateScalar(data: any, schema: any, ctx: ValidationContext): RawError[] {
  const errors: RawError[] = [];
  const base = schema.type === 'integer' ? 'number' : schema.type;
  const typeOk = base ? typeOf(data) === base : true;

  if (base && !typeOk) {
    errors.push(typeMismatch(schema.type, typeOf(data), ctx));
  }

  // Constraints only make sense once the base type matches.
  if (typeOk) {
    if (schema.type === 'integer' && !Number.isInteger(data)) {
      errors.push(constraint(ctx, `Expected an integer, but received ${JSON.stringify(data)}`));
    }
    if (base === 'string') errors.push(...stringConstraints(data, schema, ctx));
    if (base === 'number') errors.push(...numberConstraints(data, schema, ctx));
  }

  errors.push(...validateEnumConst(data, schema, ctx));
  return errors;
}

/** A value referencing a known variable by name — check its resolved type. */
function validateVariableRef(name: string, schema: any, ctx: ValidationContext): RawError[] {
  const varType = ctx.variableTypes.get(name)!;
  const expected = schema.type;
  if (expected && varType !== 'unknown' && varType !== expected) {
    return [typeMismatch(expected, varType, ctx, `Variable "${name}" is ${varType}, but expected ${expected}`)];
  }
  return [];
}

/** A `__JS_EXPR__` value — resolve against a variable if possible, else accept as opaque. */
function validateExpression(raw: string, schema: any, ctx: ValidationContext): RawError[] {
  const expr = raw.substring('__JS_EXPR__'.length);
  const expected = schema.type;
  if (ctx.variableTypes.has(expr)) {
    const varType = ctx.variableTypes.get(expr)!;
    if (expected && varType !== 'unknown' && varType !== expected) {
      return [typeMismatch(expected, varType, ctx, `Variable "${expr}" is ${varType}, but expected ${expected}`)];
    }
    return [];
  }
  return [
    {
      code: 'invalid_type',
      message: `Expected ${expected}, but received JavaScript expression`,
      path: ctx.path,
      expected,
      received: 'expression',
      jsExpression: expr,
    },
  ];
}

/** Objects: unrecognized keys, required props, then recurse into each property. */
function validateObject(data: any, schema: any, ctx: ValidationContext): RawError[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [typeMismatch('object', typeOf(data), ctx)];
  }

  const errors: RawError[] = [];
  const unrecognized: string[] = [];

  // Unrecognized keys (only when the schema forbids extras).
  if (schema.additionalProperties === false && schema.properties) {
    const allowedProps = Object.keys(schema.properties);
    for (const prop of Object.keys(data)) {
      if (!allowedProps.includes(prop)) {
        unrecognized.push(prop);
        errors.push({
          code: 'unrecognized_keys',
          message: `Unrecognized key: "${prop}"`,
          path: [...ctx.path, prop],
          keys: [prop],
          allowedKeys: allowedProps,
          schemaProperties: schema.properties,
        });
      }
    }
  }

  // Skip required checks when there are unrecognized keys (likely a typo).
  if (unrecognized.length === 0 && Array.isArray(schema.required)) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in data)) {
        errors.push({
          code: 'missing_property',
          message: `Required property "${requiredProp}" is missing`,
          path: [...ctx.path, requiredProp],
        });
      }
    }
  }

  // Recurse into present properties.
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
      if (propName in data) {
        errors.push(...validateValue(data[propName], propSchema, childContext(ctx, propName)));
      }
    }
  }

  return errors;
}

/** Arrays: check the container, length constraints, then recurse into each item. */
function validateArray(data: any, schema: any, ctx: ValidationContext): RawError[] {
  if (!Array.isArray(data)) {
    return [typeMismatch('array', typeOf(data), ctx)];
  }

  const errors: RawError[] = [];
  if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
    errors.push(constraint(ctx, `Too few items: expected at least ${schema.minItems}, but received ${data.length}`));
  }
  if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) {
    errors.push(constraint(ctx, `Too many items: expected at most ${schema.maxItems}, but received ${data.length}`));
  }

  if (schema.items) {
    for (let i = 0; i < data.length; i++) {
      errors.push(...validateValue(data[i], schema.items, childContext(ctx, String(i))));
    }
  }
  return errors;
}

/**
 * Union handling, in order of specificity:
 *  1. discriminated union (all-object members sharing a literal key) → narrow & validate the variant
 *  2. all-object union but the value isn't an object → clear "expected object" mismatch
 *  3. general union (non-discriminated objects, or unions including non-object members like
 *     `string | number`, `string | null`, literal unions) → pass if any member validates,
 *     otherwise report the closest member's errors.
 */
function validateUnion(data: any, schema: any, ctx: ValidationContext): RawError[] {
  const allMembers: any[] = Array.isArray(schema.anyOf) ? schema.anyOf.filter(Boolean) : [];
  if (allMembers.length === 0) return [];

  const objMembers = objectMembers(schema.anyOf);
  const allObjects = objMembers.length === allMembers.length;
  const dataIsObject = typeof data === 'object' && data !== null && !Array.isArray(data);

  // (1) Discriminated union.
  if (allObjects && dataIsObject) {
    const discriminant = findDiscriminantKey(objMembers);
    if (discriminant) {
      // Missing discriminant → surface it as a required-property error.
      if (!(discriminant in data)) {
        return [
          {
            code: 'missing_property',
            message: `Required property "${discriminant}" is missing`,
            path: [...ctx.path, discriminant],
          },
        ];
      }

      const discValue = data[discriminant];
      // Discriminant provided as a variable / JS expression: can't narrow reliably, skip strict checks.
      if (typeof discValue === 'string' && discValue.startsWith('__JS_EXPR__')) return [];

      const chosen = narrowUnionByLiteral(objMembers, discriminant, discValue);
      if (!chosen) {
        const allowed = discriminantLiterals(objMembers, discriminant).map((v) => JSON.stringify(v)).join(' | ');
        return [
          {
            code: 'invalid_enum_value',
            message: `Expected one of ${allowed}, received ${JSON.stringify(discValue)}`,
            path: [...ctx.path, discriminant],
            expected: allowed,
            received: JSON.stringify(discValue),
          },
        ];
      }

      // Validate against the matched variant only.
      return validateObject(data, chosen, ctx);
    }
  }

  // (2) Pure object union but the value isn't an object → clear type mismatch.
  if (allObjects && !dataIsObject) {
    return [typeMismatch('object', typeOf(data), ctx)];
  }

  // (3) General union: succeed if any member matches, else the closest one's errors.
  let best: RawError[] | null = null;
  for (const member of allMembers) {
    const errs = validateValue(data, member, ctx);
    if (errs.length === 0) return [];
    if (!best || errs.length < best.length) best = errs;
  }
  return best ?? [];
}

/** Public entry point — kept stable for `validateTrpcCall`. */
function validateWithJsonSchema(
  data: any,
  jsonSchema: any,
  variableTypes: Map<string, string> = new Map(),
): { success: boolean; errors: any[] } {
  const errors = validateValue(data, jsonSchema, { variableTypes, path: [] });
  return { success: errors.length === 0, errors };
}

function formatZodError(zodError: any, call: TrpcCall): ValidationError {
  const path = zodError.path || [];
  let message = zodError.message;
  let expected: string | undefined;
  let received: string | undefined;

  // Improve error messages
  if (zodError.code === 'missing_property') {
    // No expected/received chips: the value is simply absent. The title names the
    // property, and the highlight points at the object that should contain it.
    message = `Missing required property "${path[path.length - 1]}"`;
  } else if (zodError.code === 'invalid_type') {
    expected = zodError.expected;
    if (zodError.received === 'expression' && zodError.jsExpression) {
      message = 'Type mismatch';
      received = zodError.jsExpression;
    } else {
      message = 'Type mismatch';
      received = zodError.received;
    }
  } else if (zodError.code === 'invalid_enum_value') {
    message = 'Invalid value';
    expected = zodError.expected;
    received = zodError.received;
  } else if (zodError.code === 'invalid_literal') {
    message = 'Invalid literal';
    expected = zodError.expected;
    received = zodError.received;
  } else if (zodError.code === 'invalid_constraint') {
    // Message is already fully built by the validator (length/range/pattern/items).
    // No chips — the title is self-contained.
  } else if (zodError.code === 'unrecognized_keys') {
    message = `Unrecognized key: "${path[0]}"`;

    // Add available properties with their types
    if (zodError.allowedKeys && zodError.allowedKeys.length > 0) {
      message += '\n\n';
      message += 'Available properties:\n';
      message += zodError.allowedKeys
        .map((key: string) => {
          let typeName = 'unknown';

          if (zodError.schemaProperties?.[key]) {
            const propSchema = zodError.schemaProperties[key];
            if (propSchema.type) {
              typeName = propSchema.type;
            }
          }

          return `  • ${key} (${typeName})`;
        })
        .join('\n');
      message += '\n\n';
    }
  }

  // Highlight the exact offending token by walking the full path (nested objects
  // and array indices included). The linter uses only `start`/`end`, so line/column
  // stay at the call's — they are not consumed downstream.
  let position = call.position;

  if (path.length > 0) {
    // - unrecognized key → highlight the key token
    // - missing property → the value is absent, so highlight the containing object (parent path)
    // - other value errors → highlight the offending value
    const span =
      zodError.code === 'unrecognized_keys'
        ? findKeySpanAtPath(call.rawCall, path)
        : zodError.code === 'missing_property'
          ? findValueSpanAtPath(call.rawCall, path.slice(0, -1))
          : zodError.code === 'invalid_type' ||
            zodError.code === 'invalid_enum_value' ||
            zodError.code === 'invalid_literal' ||
            zodError.code === 'invalid_constraint'
            ? findValueSpanAtPath(call.rawCall, path)
            : null;

    if (span) {
      position = {
        start: call.position.start + span.start,
        end: call.position.start + span.end,
        line: call.position.line,
        column: call.position.column,
      };
    }
  }

  return {
    message,
    path,
    code: zodError.code || 'validation_error',
    expected,
    received,
    position,
  };
}

export function validateTrpcCall(
  call: TrpcCall,
  schema: RouterSchema,
  variableTypes: Map<string, string> = new Map(),
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if the procedure exists
  const procedureSchema = getProcedureSchema(call.procedure, schema);

  if (!procedureSchema) {
    errors.push({
      message: `Procedure "${call.procedure}" not found`,
      code: 'procedure_not_found',
      position: call.position,
    });
    return { isValid: false, errors, warnings };
  }

  // Check if the call type matches
  if (procedureSchema.type !== call.type) {
    errors.push({
      message: `Procedure "${call.procedure}" is a ${procedureSchema.type}, but called as ${call.type}`,
      code: 'wrong_call_type',
      position: call.position,
    });
  }

  // Validate input arguments with JSON Schema
  if (procedureSchema.inputSchema) {
    const inputValidation = validateWithJsonSchema(call.args, procedureSchema.inputSchema, variableTypes);

    if (!inputValidation.success) {
      for (const jsonSchemaError of inputValidation.errors) {
        errors.push(formatZodError(jsonSchemaError, call));
      }
    }
  } else {
    // No input schema, arguments are not expected
    if (call.args !== undefined && call.args !== null) {
      warnings.push({
        message: `Procedure "${call.procedure}" does not expect any input, but arguments were provided`,
        code: 'unexpected_input',
        position: call.position,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateCode(
  calls: TrpcCall[],
  schema: RouterSchema,
  variableTypes: Map<string, string> = new Map(),
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const call of calls) {
    const result = validateTrpcCall(call, schema, variableTypes);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// Cache for validations
const validationCache = new Map<string, ValidationResult>();

export function validateCodeWithCache(
  code: string,
  calls: TrpcCall[],
  schema: RouterSchema,
  variableTypes: Map<string, string> = new Map(),
): ValidationResult {
  const varKey = [...variableTypes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  const cacheKey = `${code}-${JSON.stringify(schema)}-${varKey}`;

  if (validationCache.has(cacheKey)) {
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const result = validateCode(calls, schema, variableTypes);
  validationCache.set(cacheKey, result);

  // Limit the size of the cache
  if (validationCache.size > 100) {
    const firstKey = validationCache.keys().next().value;
    if (firstKey) {
      validationCache.delete(firstKey);
    }
  }

  return result;
}

export function clearValidationCache(): void {
  validationCache.clear();
}
