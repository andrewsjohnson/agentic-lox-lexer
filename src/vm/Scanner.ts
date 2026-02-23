import { TokenType } from './TokenType';
import { VmToken, VmErrorToken, AnyVmToken } from './Token';

export class VmScanner {
  private start: number = 0;
  private current: number = 0;
  private line: number = 1;

  constructor(private readonly source: string) {}

  scanToken(): AnyVmToken {
    this.skipWhitespace();
    this.start = this.current;

    if (this.isAtEnd()) return this.makeToken(TokenType.EOF);

    const c = this.advance();

    if (this.isAlpha(c)) return this.identifier();
    if (this.isDigit(c)) return this.number();

    switch (c) {
      case '(': return this.makeToken(TokenType.LEFT_PAREN);
      case ')': return this.makeToken(TokenType.RIGHT_PAREN);
      case '{': return this.makeToken(TokenType.LEFT_BRACE);
      case '}': return this.makeToken(TokenType.RIGHT_BRACE);
      case ';': return this.makeToken(TokenType.SEMICOLON);
      case ',': return this.makeToken(TokenType.COMMA);
      case '.': return this.makeToken(TokenType.DOT);
      case '-': return this.makeToken(TokenType.MINUS);
      case '+': return this.makeToken(TokenType.PLUS);
      case '/': return this.makeToken(TokenType.SLASH);
      case '*': return this.makeToken(TokenType.STAR);
      case '!': return this.makeToken(this.match('=') ? TokenType.BANG_EQUAL : TokenType.BANG);
      case '=': return this.makeToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
      case '<': return this.makeToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
      case '>': return this.makeToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
      case '"': return this.string();
    }

    return this.errorToken(`Unexpected character '${c}'.`);
  }

  private makeToken(type: TokenType): VmToken {
    return { type, start: this.start, length: this.current - this.start, line: this.line };
  }

  private errorToken(message: string): VmErrorToken {
    return { type: TokenType.ERROR, start: this.start, length: 0, line: this.line, message };
  }

  private advance(): string {
    return this.source[this.current++];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    return true;
  }

  private peek(): string {
    return this.source[this.current] ?? '\0';
  }

  private peekNext(): string {
    return this.source[this.current + 1] ?? '\0';
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isAlpha(c: string): boolean {
    return /[a-zA-Z_]/.test(c);
  }

  private isDigit(c: string): boolean {
    return /[0-9]/.test(c);
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private skipWhitespace(): void {
    while (true) {
      const c = this.peek();
      switch (c) {
        case ' ': case '\r': case '\t': this.advance(); break;
        case '\n': this.line++; this.advance(); break;
        case '/':
          if (this.peekNext() === '/') {
            while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
          } else return;
          break;
        default: return;
      }
    }
  }

  private string(): AnyVmToken {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') this.line++;
      this.advance();
    }
    if (this.isAtEnd()) return this.errorToken('Unterminated string.');
    this.advance(); // closing "
    return this.makeToken(TokenType.STRING);
  }

  private number(): VmToken {
    while (this.isDigit(this.peek())) this.advance();
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek())) this.advance();
    }
    return this.makeToken(TokenType.NUMBER);
  }

  private identifier(): VmToken {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    return this.makeToken(this.identifierType());
  }

  private identifierType(): TokenType {
    const keywords: Record<string, TokenType> = {
      and: TokenType.AND, class: TokenType.CLASS, else: TokenType.ELSE,
      false: TokenType.FALSE, for: TokenType.FOR, fun: TokenType.FUN,
      if: TokenType.IF, nil: TokenType.NIL, or: TokenType.OR,
      print: TokenType.PRINT, return: TokenType.RETURN, super: TokenType.SUPER,
      this: TokenType.THIS, true: TokenType.TRUE, var: TokenType.VAR,
      while: TokenType.WHILE,
    };
    const word = this.source.slice(this.start, this.current);
    return keywords[word] ?? TokenType.IDENTIFIER;
  }
}
