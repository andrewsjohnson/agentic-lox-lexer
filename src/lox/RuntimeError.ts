import { Token } from './Token';

export class RuntimeError extends Error {
  constructor(
    public readonly token: Token,
    message: string,
  ) {
    super(message);
  }
}
