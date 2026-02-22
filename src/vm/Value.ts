export type VmValue = null | boolean | number | string | VmObject;

// VmObject covers heap-allocated values (strings, functions, etc.)
// We'll expand this in later steps. For now it's a placeholder.
export interface VmObject {
  readonly type: 'string' | 'function' | 'closure' | 'upvalue'
                | 'class' | 'instance' | 'bound_method' | 'native';
}

export function printValue(value: VmValue): string {
  if (value === null) return 'nil';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'string') return value;
  return '[object]';
}

export function valuesEqual(a: VmValue, b: VmValue): boolean {
  if (typeof a !== typeof b && !(a === null || b === null)) return false;
  return a === b;
}
