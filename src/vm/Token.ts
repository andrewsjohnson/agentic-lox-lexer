import { TokenType } from './TokenType';

export interface VmToken {
  type: TokenType;
  start: number;      // index into the source string
  length: number;     // length of the lexeme
  line: number;
}

export interface VmErrorToken extends VmToken {
  type: TokenType.ERROR;
  message: string;
}

export type AnyVmToken = VmToken | VmErrorToken;

/**
 * Helper to get the actual lexeme string from a source + token.
 * For error tokens, returns an empty string.
 */
export function getLexeme(source: string, token: AnyVmToken): string {
  return source.slice(token.start, token.start + token.length);
}
