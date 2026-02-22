import type { LoxValue } from './Interpreter';

export class Return extends Error {
  constructor(public readonly value: LoxValue) {
    super();
  }
}
