import { Token } from './Token';
import { RuntimeError } from './RuntimeError';
import type { LoxValue } from './Interpreter';
import type { LoxClass } from './LoxClass';

export class LoxInstance {
  private fields = new Map<string, LoxValue>();

  constructor(private readonly klass: LoxClass) {}

  get(name: Token): LoxValue {
    if (this.fields.has(name.lexeme)) {
      return this.fields.get(name.lexeme)!;
    }
    const method = this.klass.findMethod(name.lexeme);
    if (method !== undefined) return method.bind(this);
    throw new RuntimeError(name, `Undefined property '${name.lexeme}'.`);
  }

  set(name: Token, value: LoxValue): void {
    this.fields.set(name.lexeme, value);
  }

  toString(): string {
    return `${this.klass.name} instance`;
  }
}
