import type { VariableType } from '../types';

export function validateVariableValue(value: string, type: VariableType): string | null {
  if (!value.trim()) return null;
  switch (type) {
    case 'string':
      return null;
    case 'number':
      return Number.isNaN(Number(value)) ? 'Must be a valid number' : null;
    case 'boolean':
      return ['true', 'false', '1', '0'].includes(value.trim().toLowerCase()) ? null : 'Must be true, false, 1 or 0';
    case 'null':
      return null;
    case 'object':
      try {
        const p = JSON.parse(value);
        return p && typeof p === 'object' && !Array.isArray(p) ? null : 'Must be a valid JSON object';
      } catch {
        return 'Must be a valid JSON object';
      }
    case 'array':
      try {
        return Array.isArray(JSON.parse(value)) ? null : 'Must be a valid JSON array';
      } catch {
        return 'Must be a valid JSON array';
      }
    case 'json':
      try {
        JSON.parse(value);
        return null;
      } catch {
        return 'Must be valid JSON';
      }
  }
}
