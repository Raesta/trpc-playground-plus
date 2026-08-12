import { describe, expect, it } from 'vitest';
import { validateVariableValue } from './variable-validation';

describe('validateVariableValue', () => {
  it('treats an empty value as valid for any type', () => {
    expect(validateVariableValue('', 'number')).toBeNull();
    expect(validateVariableValue('   ', 'object')).toBeNull();
  });

  it('accepts any string', () => {
    expect(validateVariableValue('anything', 'string')).toBeNull();
  });

  it('validates numbers', () => {
    expect(validateVariableValue('42', 'number')).toBeNull();
    expect(validateVariableValue('nope', 'number')).toBe('Must be a valid number');
  });

  it('validates booleans (true/false/1/0)', () => {
    for (const ok of ['true', 'FALSE', '1', '0']) expect(validateVariableValue(ok, 'boolean')).toBeNull();
    expect(validateVariableValue('yes', 'boolean')).toBe('Must be true, false, 1 or 0');
  });

  it('validates objects', () => {
    expect(validateVariableValue('{"a":1}', 'object')).toBeNull();
    expect(validateVariableValue('[1,2]', 'object')).toBe('Must be a valid JSON object');
    expect(validateVariableValue('{bad', 'object')).toBe('Must be a valid JSON object');
  });

  it('validates arrays', () => {
    expect(validateVariableValue('[1,2]', 'array')).toBeNull();
    expect(validateVariableValue('{"a":1}', 'array')).toBe('Must be a valid JSON array');
  });

  it('validates arbitrary JSON', () => {
    expect(validateVariableValue('{"a":[1,2]}', 'json')).toBeNull();
    expect(validateVariableValue('not json', 'json')).toBe('Must be valid JSON');
  });

  it('accepts null type without checking the value', () => {
    expect(validateVariableValue('whatever', 'null')).toBeNull();
  });
});
