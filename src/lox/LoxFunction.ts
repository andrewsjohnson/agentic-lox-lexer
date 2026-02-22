import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';
import type { LoxInstance } from './LoxInstance';
import { Stmt } from './Stmt';
import { Environment } from './Environment';
import { Return } from './Return';
import { LoxCallable } from './LoxCallable';

export class LoxFunction implements LoxCallable {
  constructor(
    private readonly declaration: Stmt.Function,
    private readonly closure: Environment,
    private readonly isInitializer: boolean = false,
  ) {}

  arity(): number {
    return this.declaration.params.length;
  }

  bind(instance: LoxInstance): LoxFunction {
    const env = new Environment(this.closure);
    env.define('this', instance);
    return new LoxFunction(this.declaration, env, this.isInitializer);
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const env = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      env.define(this.declaration.params[i].lexeme, args[i]);
    }
    try {
      interpreter.executeBlock(this.declaration.body, env);
    } catch (err) {
      if (err instanceof Return) {
        if (this.isInitializer) return this.closure.getAt(0, 'this');
        return err.value;
      }
      throw err;
    }
    if (this.isInitializer) return this.closure.getAt(0, 'this');
    return null;
  }

  toString(): string {
    return `<fn ${this.declaration.name.lexeme}>`;
  }
}
