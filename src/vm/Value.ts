export type VmValue = null | boolean | number | string | VmObject;

// VmObject covers heap-allocated values (strings, functions, etc.)
// We'll expand this in later steps. For now it's a placeholder.
export interface VmObject {
  readonly type: 'string' | 'function' | 'closure' | 'upvalue'
                | 'class' | 'instance' | 'bound_method' | 'native';
}

export function isNil(v: VmValue): v is null {
  return v === null;
}

export function isBool(v: VmValue): v is boolean {
  return typeof v === 'boolean';
}

export function isNumber(v: VmValue): v is number {
  return typeof v === 'number';
}

export function isString(v: VmValue): v is string {
  return typeof v === 'string';
}

export function printValue(value: VmValue): string {
  if (value === null) return 'nil';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.toString();
  return 'nil';
}

export function valuesEqual(a: VmValue, b: VmValue): boolean {
  if (typeof a !== typeof b) {
    if (!(a === null || b === null)) return false;
    return a === b;
  }
  return a === b;
}
