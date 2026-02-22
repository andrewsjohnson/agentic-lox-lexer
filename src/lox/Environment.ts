import { Token } from './Token';
import { RuntimeError } from './RuntimeError';
import { LoxValue } from './Interpreter';

export class Environment {
  readonly values = new Map<string, LoxValue>();

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

  getAt(distance: number, name: string): LoxValue {
    return this.ancestor(distance).values.get(name) ?? null;
  }

  assignAt(distance: number, name: Token, value: LoxValue): void {
    this.ancestor(distance).values.set(name.lexeme, value);
  }

  private ancestor(distance: number): Environment {
    let env: Environment = this;
    for (let i = 0; i < distance; i++) env = env.enclosing!;
    return env;
  }
}
