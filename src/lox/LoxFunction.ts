import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';
import { Stmt } from './Stmt';
import { Environment } from './Environment';
import { Return } from './Return';
import { LoxCallable } from './LoxCallable';

export class LoxFunction implements LoxCallable {
  constructor(
    private readonly declaration: Stmt.Function,
    private readonly closure: Environment,
  ) {}

  arity(): number {
    return this.declaration.params.length;
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const env = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      env.define(this.declaration.params[i].lexeme, args[i]);
    }
    try {
      interpreter.executeBlock(this.declaration.body, env);
    } catch (err) {
      if (err instanceof Return) return err.value;
      throw err;
    }
    return null;
  }

  toString(): string {
    return `<fn ${this.declaration.name.lexeme}>`;
  }
}
