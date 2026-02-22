import { Token } from './Token';
import { RuntimeError } from './RuntimeError';
import { LoxValue } from './Interpreter';

export class Environment {
  private values = new Map<string, LoxValue>();

  constructor(public readonly enclosing: Environment | null = null) {}

  define(name: string, value: LoxValue): void {
    this.values.set(name, value);
  }

  get(name: Token): LoxValue {
    if (this.values.has(name.lexeme)) return this.values.get(name.lexeme)!;
    if (this.enclosing) return this.enclosing.get(name);
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }

  assign(name: Token, value: LoxValue): void {
    if (this.values.has(name.lexeme)) {
      this.values.set(name.lexeme, value);
      return;
    }
    if (this.enclosing) {
      this.enclosing.assign(name, value);
      return;
    }
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }
}
