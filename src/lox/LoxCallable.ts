import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';

export interface LoxCallable {
  arity(): number;
  call(interpreter: Interpreter, args: LoxValue[]): LoxValue;
  toString(): string;
}

export function isLoxCallable(value: unknown): value is LoxCallable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LoxCallable).call === 'function' &&
    typeof (value as LoxCallable).arity === 'function'
  );
}
