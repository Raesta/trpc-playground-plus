import type { Header, Variable } from '../types';
import { validateVariableValue } from './variable-validation';

const VALID_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function getDrawerErrors(variables: Variable[], headers: Header[]): string[] {
  const errors: string[] = [];

  for (const v of variables) {
    if (!v.enabled) continue;
    const key = v.key.trim();
    if (key && !VALID_KEY.test(key)) {
      errors.push(`Variable "${key}": invalid name`);
    }
    if (v.type !== 'null') {
      const err = validateVariableValue(v.value, v.type || 'string');
      if (err) errors.push(`Variable "${key || '(unnamed)'}": ${err}`);
    }
  }

  for (const h of headers) {
    if (!h.enabled) continue;
    if (!h.key.trim() && h.value.trim()) {
      errors.push('Header: missing key');
    }
  }

  return errors;
}
