import { RouterSchema } from '../types';
import { TrpcCall } from './code-parser';

export interface ValidationError {
  message: string;
  path?: string[];
  code: string;
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
  schema: RouterSchema
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
    type: procDef.type
  };
}

function validateWithJsonSchema(data: any, jsonSchema: any): { success: boolean; errors: any[] } {
  if (!jsonSchema) {
    return { success: true, errors: [] };
  }

  const errors: any[] = [];
  const unrecognizedKeys: string[] = [];

  // Validation for objects
  if (jsonSchema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push({
        code: 'invalid_type',
        message: `Expected object, but received ${Array.isArray(data) ? 'array' : typeof data}`,
        path: [],
        expected: 'object',
        received: Array.isArray(data) ? 'array' : typeof data
      });
      return { success: false, errors };
    }

    // First check additional properties (unrecognized keys)
    if (jsonSchema.additionalProperties === false && jsonSchema.properties) {
      const allowedProps = Object.keys(jsonSchema.properties);
      for (const prop of Object.keys(data)) {
        if (!allowedProps.includes(prop)) {
          unrecognizedKeys.push(prop);
          errors.push({
            code: 'unrecognized_keys',
            message: `Unrecognized key: "${prop}"`,
            path: [prop],
            keys: [prop],
            allowedKeys: allowedProps,
            schemaProperties: jsonSchema.properties
          });
        }
      }
    }

    // If we have unrecognized keys, don't check required properties
    // (car c'est probablement juste une faute de frappe)
    if (unrecognizedKeys.length === 0) {
      // Check required properties
      if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
        for (const requiredProp of jsonSchema.required) {
          if (!(requiredProp in data)) {
            errors.push({
              code: 'invalid_type',
              message: `Required property "${requiredProp}" is missing`,
              path: [requiredProp],
              expected: 'defined',
              received: 'undefined'
            });
          }
        }
      }
    }

    // Check property types
    if (jsonSchema.properties) {
      for (const [propName, propSchema] of Object.entries(jsonSchema.properties as Record<string, any>)) {
        if (propName in data) {
          const propValue = data[propName];
          const propType = propSchema.type;

          // Check if it's a JavaScript expression
          const isJsExpr = typeof propValue === 'string' && propValue.startsWith('__JS_EXPR__');

          if (isJsExpr) {
            const jsExpr = propValue.substring('__JS_EXPR__'.length);
            errors.push({
              code: 'invalid_type',
              message: `Expected ${propType}, but received JavaScript expression`,
              path: [propName],
              expected: propType,
              received: 'expression',
              jsExpression: jsExpr
            });
          } else if (propType === 'string' && typeof propValue !== 'string') {
            errors.push({
              code: 'invalid_type',
              message: `Expected string, but received ${typeof propValue}`,
              path: [propName],
              expected: 'string',
              received: typeof propValue
            });
          } else if (propType === 'number' && typeof propValue !== 'number') {
            errors.push({
              code: 'invalid_type',
              message: `Expected number, but received ${typeof propValue}`,
              path: [propName],
              expected: 'number',
              received: typeof propValue
            });
          } else if (propType === 'boolean' && typeof propValue !== 'boolean') {
            errors.push({
              code: 'invalid_type',
              message: `Expected boolean, but received ${typeof propValue}`,
              path: [propName],
              expected: 'boolean',
              received: typeof propValue
            });
          } else if (propType === 'object' && (typeof propValue !== 'object' || propValue === null || Array.isArray(propValue))) {
            errors.push({
              code: 'invalid_type',
              message: `Expected object, but received ${Array.isArray(propValue) ? 'array' : typeof propValue}`,
              path: [propName],
              expected: 'object',
              received: Array.isArray(propValue) ? 'array' : typeof propValue
            });
          }
        }
      }
    }
  } else if (jsonSchema.type === 'string') {
    if (typeof data !== 'string') {
      errors.push({
        code: 'invalid_type',
        message: `Expected string, but received ${typeof data}`,
        path: [],
        expected: 'string',
        received: typeof data
      });
    }
  } else if (jsonSchema.type === 'number') {
    if (typeof data !== 'number') {
      errors.push({
        code: 'invalid_type',
        message: `Expected number, but received ${typeof data}`,
        path: [],
        expected: 'number',
        received: typeof data
      });
    }
  }

  return { success: errors.length === 0, errors };
}

function formatZodError(zodError: any, call: TrpcCall): ValidationError {
  const path = zodError.path || [];
  let message = zodError.message;

  // Improve error messages
  if (zodError.code === 'invalid_type') {
    if (zodError.received === 'expression' && zodError.jsExpression) {
      message = `Expected ${zodError.expected}, received JavaScript expression`;
      if (path.length > 0) {
        message += `\n\nProperty: ${path.join('.')}`;
      }
      message += `\nExpression: ${zodError.jsExpression}`;
      message += '\n\n';
    } else {
      message = `Expected ${zodError.expected}, received ${zodError.received}`;
      if (path.length > 0) {
        message += `\n\nProperty: ${path.join('.')}`;
      }
      message += '\n\n';
    }
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
      message += zodError.allowedKeys.map((key: string) => {
        let typeName = 'unknown';

        if (zodError.schemaProperties && zodError.schemaProperties[key]) {
          const propSchema = zodError.schemaProperties[key];
          if (propSchema.type) {
            typeName = propSchema.type;
          }
        }

        return `  • ${key} (${typeName})`;
      }).join('\n');
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
          column: call.position.column + match.index
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
          column: call.position.column + match.index + match[0].indexOf(match[1])
        };
      }
    }
  }

  return {
    message,
    path,
    code: zodError.code || 'validation_error',
    position
  };
}

export function validateTrpcCall(
  call: TrpcCall,
  schema: RouterSchema
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if the procedure exists
  const procedureSchema = getProcedureSchema(call.procedure, schema);

  if (!procedureSchema) {
    errors.push({
      message: `Procedure "${call.procedure}" not found`,
      code: 'procedure_not_found',
      position: call.position
    });
    return { isValid: false, errors, warnings };
  }

  // Check if the call type matches
  if (procedureSchema.type !== call.type) {
    errors.push({
      message: `Procedure "${call.procedure}" is a ${procedureSchema.type}, but called as ${call.type}`,
      code: 'wrong_call_type',
      position: call.position
    });
  }

  // Validate input arguments with JSON Schema
  if (procedureSchema.inputSchema) {
    const inputValidation = validateWithJsonSchema(call.args, procedureSchema.inputSchema);

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
        position: call.position
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateCode(
  calls: TrpcCall[],
  schema: RouterSchema
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  for (const call of calls) {
    const result = validateTrpcCall(call, schema);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

// Cache for validations
const validationCache = new Map<string, ValidationResult>();

export function validateCodeWithCache(
  code: string,
  calls: TrpcCall[],
  schema: RouterSchema
): ValidationResult {
  const cacheKey = `${code}-${JSON.stringify(schema)}`;

  if (validationCache.has(cacheKey)) {
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const result = validateCode(calls, schema);
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