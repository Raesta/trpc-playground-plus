import type { RouterSchema } from '../types';
import type { TrpcCall } from './code-parser';

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

/** Literal value of a schema that represents a single literal (const or single-value enum). */
function singleLiteral(prop: any): any {
  if (!prop) return undefined;
  if (prop.const !== undefined) return prop.const;
  if (Array.isArray(prop.enum) && prop.enum.length === 1) return prop.enum[0];
  return undefined;
}

/** Discriminant key of a union: a property holding a single literal in every member. */
function findDiscriminantKey(members: any[]): string | null {
  const keys = members[0]?.properties ? Object.keys(members[0].properties) : [];
  for (const key of keys) {
    if (members.every((m) => singleLiteral(m.properties?.[key]) !== undefined)) return key;
  }
  return null;
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

  if (schema.type === 'string' || schema.type === 'number' || schema.type === 'boolean') {
    return validateScalar(data, schema, ctx);
  }

  // Arrays and other constructs are not deep-validated yet (see ROADMAP §1);
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

/** string / number / boolean primitives (+ any enum/const on them). */
function validateScalar(data: any, schema: any, ctx: ValidationContext): RawError[] {
  const errors: RawError[] = [];
  const expected = schema.type;
  if (expected && typeof data !== expected) {
    errors.push(typeMismatch(expected, typeOf(data), ctx));
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
          code: 'invalid_type',
          message: `Required property "${requiredProp}" is missing`,
          path: [...ctx.path, requiredProp],
          expected: 'defined',
          received: 'undefined',
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

/** Union / discriminated union: narrow to the right member, then validate it. */
function validateUnion(data: any, schema: any, ctx: ValidationContext): RawError[] {
  const members = schema.anyOf.filter((m: any) => m && m.type === 'object' && m.properties);
  if (members.length === 0) return [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [typeMismatch('object', typeOf(data), ctx)];
  }

  const discriminant = findDiscriminantKey(members);
  if (discriminant) {
    // Missing discriminant → surface it as a required-property error.
    if (!(discriminant in data)) {
      return [
        {
          code: 'invalid_type',
          message: `Required property "${discriminant}" is missing`,
          path: [...ctx.path, discriminant],
          expected: 'defined',
          received: 'undefined',
        },
      ];
    }

    const discValue = data[discriminant];
    // Discriminant provided as a variable / JS expression: can't narrow reliably, skip strict checks.
    if (typeof discValue === 'string' && discValue.startsWith('__JS_EXPR__')) return [];

    const chosen = members.find((m: any) => singleLiteral(m.properties[discriminant]) === discValue);
    if (!chosen) {
      const allowed = members.map((m: any) => JSON.stringify(singleLiteral(m.properties[discriminant]))).join(' | ');
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

  // Non-discriminated union: succeed if any member matches, else the closest one's errors.
  let best: RawError[] | null = null;
  for (const member of members) {
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
  if (zodError.code === 'invalid_type') {
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
  } else if (zodError.code === 'too_small') {
    message = `Value is too small. Minimum is ${zodError.minimum}`;
  } else if (zodError.code === 'too_big') {
    message = `Value is too large. Maximum is ${zodError.maximum}`;
  } else if (zodError.code === 'invalid_string') {
    message = `Invalid string format`;
    if (zodError.validation) {
      message += `: ${zodError.validation}`;
    }
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

  // Calculate the exact position of the error in the code
  let position = call.position;

  if (path.length > 0) {
    const propertyName = path[0];

    if (zodError.code === 'unrecognized_keys') {
      // For unrecognized keys, highlight the property name
      const propertyPattern = new RegExp(`\\b${propertyName}\\s*:`);
      const match = propertyPattern.exec(call.rawCall);

      if (match) {
        const propertyStart = call.position.start + match.index;
        const propertyEnd = propertyStart + propertyName.length;

        position = {
          start: propertyStart,
          end: propertyEnd,
          line: call.position.line,
          column: call.position.column + match.index,
        };
      }
    } else if (zodError.code === 'invalid_type') {
      // For type errors, highlight the incorrect value
      let propertyPattern: RegExp;

      // If it's a JS expression, we need to capture it correctly (ex: "new Date()")
      if (zodError.received === 'expression') {
        // Pattern to capture expressions with parentheses
        propertyPattern = new RegExp(`\\b${propertyName}\\s*:\\s*([^,}]+?)(?=\\s*[,}])`);
      } else {
        propertyPattern = new RegExp(`\\b${propertyName}\\s*:\\s*([^,}\\n]+)`);
      }

      const match = propertyPattern.exec(call.rawCall);

      if (match) {
        const valueStart = call.position.start + match.index + match[0].indexOf(match[1]);
        const valueEnd = valueStart + match[1].trim().length;

        position = {
          start: valueStart,
          end: valueEnd,
          line: call.position.line,
          column: call.position.column + match.index + match[0].indexOf(match[1]),
        };
      }
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
