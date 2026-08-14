import { splitTopLevel } from './brace-scan';

export interface TrpcCall {
  procedure: string;
  type: 'query' | 'mutation';
  args: any;
  position: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  rawCall: string;
}

export interface ParseResult {
  calls: TrpcCall[];
  errors: Array<{
    message: string;
    position: { start: number; end: number };
  }>;
}

function parseArguments(argsString: string): any {
  try {
    // Simple parsing for basic JSON objects
    if (argsString.trim() === '') return undefined;

    // If it's a literal object, try to evaluate it safely
    if (argsString.trim().startsWith('{') && argsString.trim().endsWith('}')) {
      const jsonString = argsString
        .replace(/(\w+):/g, '"$1":') // quote property names
        .replace(/'/g, '"'); // replace single quotes with double quotes

      try {
        return JSON.parse(jsonString);
      } catch {
        // If JSON.parse fails, parse manually to extract the structure
        return parseObjectLiteral(argsString.trim());
      }
    }

    // For other types (strings, numbers, etc.)
    if (argsString.startsWith('"') || argsString.startsWith("'")) {
      return argsString.slice(1, -1); // Remove quotes
    }

    if (!Number.isNaN(Number(argsString))) {
      return Number(argsString);
    }

    return argsString;
  } catch (_error) {
    return argsString; // Fallback to raw string
  }
}

function parseObjectLiteral(str: string): any {
  // Manual parser for literal objects with JS expressions
  const result: any = {};

  // Remove the braces
  const content = str.slice(1, -1).trim();

  // Parse properties with balanced parentheses handling
  let i = 0;
  while (i < content.length) {
    // Skip the spaces
    while (i < content.length && /\s/.test(content[i])) i++;
    if (i >= content.length) break;

    // Extract the property name
    const keyMatch = content.slice(i).match(/^(\w+)\s*:/);
    if (!keyMatch) {
      // Handle shorthand property syntax: { text, name } → { text: text, name: name }
      const shorthandMatch = content.slice(i).match(/^(\w+)\s*[,}]?/);
      if (shorthandMatch) {
        const key = shorthandMatch[1];
        result[key] = `__JS_EXPR__${key}`;
        i += key.length;
        // Skip spaces and comma
        while (i < content.length && /\s/.test(content[i])) i++;
        if (content[i] === ',') i++;
        continue;
      }
      break;
    }

    const key = keyMatch[1];
    i += keyMatch[0].length;

    // Skip spaces after the ':'
    while (i < content.length && /\s/.test(content[i])) i++;

    // Extract the value handling parentheses, braces, brackets
    const valueStart = i;
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let stringChar = '';

    while (i < content.length) {
      const char = content[i];

      if (inString) {
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        } else if (char === '{') {
          braceDepth++;
        } else if (char === '}') {
          braceDepth--;
        } else if (char === '[') {
          bracketDepth++;
        } else if (char === ']') {
          bracketDepth--;
        } else if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
          break;
        }
      }
      i++;
    }

    const valueStr = content.slice(valueStart, i).trim();
    result[key] = parseValue(valueStr);

    // Skip comma if present
    if (content[i] === ',') i++;
  }

  return result;
}

/**
 * Determine the runtime value of a single literal token (object property value or
 * array element). Nested objects/arrays recurse; anything not recognised as a JSON
 * literal is treated as a JavaScript expression and marked with `__JS_EXPR__`.
 */
function parseValue(valueStr: string): any {
  if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
    return valueStr.slice(1, -1); // String
  }
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (valueStr === 'null') return null;
  if (valueStr === 'undefined') return undefined;
  if (valueStr !== '' && !Number.isNaN(Number(valueStr))) return Number(valueStr);
  if (valueStr.startsWith('{')) return parseObjectLiteral(valueStr);
  if (valueStr.startsWith('[')) return parseArrayLiteral(valueStr);
  // JavaScript expression (new Date(), a function call, a variable reference, …).
  return `__JS_EXPR__${valueStr}`;
}

/** Parse an array literal into its elements, each resolved via `parseValue`. */
function parseArrayLiteral(str: string): any[] {
  const content = str.slice(1, -1).trim(); // drop the surrounding [ ]
  return splitTopLevel(content).map(parseValue);
}

function getLineAndColumn(text: string, position: number): { line: number; column: number } {
  const lines = text.substring(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

export function parseCodeForTrpcCalls(code: string): ParseResult {
  const calls: TrpcCall[] = [];
  const errors: Array<{ message: string; position: { start: number; end: number } }> = [];
  const trpcCallStartRegex = /trpc\.(\w+(?:\.\w+)*)\.(query|mutate)\s*\(/g;

  for (let match = trpcCallStartRegex.exec(code); match !== null; match = trpcCallStartRegex.exec(code)) {
    const procedurePath = match[1];
    const callType = match[2];
    const start = match.index;
    const argsStart = match.index + match[0].length;

    try {
      // Count parentheses to find the end of the call
      let parenDepth = 1; // We've already seen the opening parenthesis
      let i = argsStart;
      let inString = false;
      let stringChar = '';

      while (i < code.length && parenDepth > 0) {
        const char = code[i];

        if (inString) {
          if (char === stringChar && code[i - 1] !== '\\') {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
          } else if (char === '(') {
            parenDepth++;
          } else if (char === ')') {
            parenDepth--;
          }
        }
        i++;
      }

      if (parenDepth !== 0) {
        // Unbalanced parentheses
        errors.push({
          message: 'Unbalanced parentheses in tRPC call',
          position: { start, end: i },
        });
        continue;
      }

      const end = i;
      const fullMatch = code.substring(start, end);
      const argsString = code.substring(argsStart, end - 1); // -1 to exclude the closing parenthesis
      const procedure = procedurePath;
      const type = callType === 'mutate' ? 'mutation' : 'query';
      const args = parseArguments(argsString.trim());
      const position = getLineAndColumn(code, start);

      calls.push({
        procedure,
        type,
        args,
        position: {
          start,
          end,
          line: position.line,
          column: position.column,
        },
        rawCall: fullMatch,
      });
    } catch (error) {
      errors.push({
        message: `Failed to parse tRPC call: ${error instanceof Error ? error.message : 'Unknown error'}`,
        position: { start, end: start + 100 },
      });
    }
  }

  return { calls, errors };
}
