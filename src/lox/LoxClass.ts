import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';
import type { LoxCallable } from './LoxCallable';
import { LoxFunction } from './LoxFunction';
import { LoxInstance } from './LoxInstance';

export class LoxClass implements LoxCallable {
  constructor(
    public readonly name: string,
    public readonly superclass: LoxClass | null,
    private readonly methods: Map<string, LoxFunction>,
  ) {}

  arity(): number {
    const init = this.findMethod('init');
    return init ? init.arity() : 0;
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const instance = new LoxInstance(this);
    const init = this.findMethod('init');
    if (init !== undefined) init.bind(instance).call(interpreter, args);
    return instance;
  }

  findMethod(name: string): LoxFunction | undefined {
    if (this.methods.has(name)) return this.methods.get(name);
    if (this.superclass) return this.superclass.findMethod(name);
    return undefined;
  }

  toString(): string {
    return this.name;
  }
}
