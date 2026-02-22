import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';
import type { LoxCallable } from './LoxCallable';
import { LoxFunction } from './LoxFunction';
import { LoxInstance } from './LoxInstance';

export class LoxClass implements LoxCallable {
  constructor(
    public readonly name: string,
    private readonly methods: Map<string, LoxFunction>,
  ) {}

  arity(): number {
    const init = this.methods.get('init');
    return init ? init.arity() : 0;
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const instance = new LoxInstance(this);
    const init = this.findMethod('init');
    if (init !== undefined) init.bind(instance).call(interpreter, args);
    return instance;
  }

  findMethod(name: string): LoxFunction | undefined {
    return this.methods.get(name);
  }

  toString(): string {
    return this.name;
  }
}
