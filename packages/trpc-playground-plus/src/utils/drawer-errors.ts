import type { Header, Variable } from '../types';
import { validateVariableValue } from './variable-validation';

const VALID_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function collectVariableErrors(variables: Variable[], scopeLabel: string): string[] {
  const errors: string[] = [];
  for (const v of variables) {
    if (!v.enabled) continue;
    const key = v.key.trim();
    if (key && !VALID_KEY.test(key)) {
      errors.push(`${scopeLabel} variable "${key}": invalid name`);
    }
    if (v.type !== 'null') {
      const err = validateVariableValue(v.value, v.type || 'string');
      if (err) errors.push(`${scopeLabel} variable "${key || '(unnamed)'}": ${err}`);
    }
  }
  return errors;
}

function collectHeaderErrors(headers: Header[], scopeLabel: string): string[] {
  const errors: string[] = [];
  for (const h of headers) {
    if (!h.enabled) continue;
    if (!h.key.trim() && h.value.trim()) {
      errors.push(`${scopeLabel} header: missing key`);
    }
  }
  return errors;
}

export function getDrawerErrors(
  tabVariables: Variable[],
  tabHeaders: Header[],
  globalVariables: Variable[] = [],
  globalHeaders: Header[] = [],
): string[] {
  return [
    ...collectVariableErrors(tabVariables, 'Tab'),
    ...collectHeaderErrors(tabHeaders, 'Tab'),
    ...collectVariableErrors(globalVariables, 'Global'),
    ...collectHeaderErrors(globalHeaders, 'Global'),
  ];
}
