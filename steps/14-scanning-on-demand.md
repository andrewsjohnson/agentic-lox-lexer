# Step 14 — Scanning on Demand

**Book reference**: Chapter 16 — Scanning on Demand
**Builds on**: Step 13 (virtual machine)

---

## Overview

The tree-walk interpreter (Part II) used a scanner that eagerly produces all
tokens upfront. The bytecode compiler uses a different approach: **on-demand
scanning**, where the compiler requests one token at a time as needed.

This step implements a second scanner (`src/vm/Scanner.ts`) tuned for the
compiler. It is functionally identical to the Part II scanner but structured
as an iterator rather than a batch processor.

---

## What to Implement

### `src/vm/TokenType.ts`

Identical to `src/lox/TokenType.ts` — copy and place in the `vm/` package.
(Or re-export from a shared location — but keeping them separate mirrors the
book's two-implementation approach and avoids coupling.)

### `src/vm/Token.ts`

A lightweight token struct for the VM scanner. Unlike Part II's `Token`, this
one stores a `start` offset and `length` into the source string (not a copy of
the lexeme) for performance:

```typescript
export interface VmToken {
  type: TokenType;
  start: number;      // index into the source string
  length: number;     // length of the lexeme
  line: number;
}

// Helper to get the actual lexeme string from a source + token
export function getLexeme(source: string, token: VmToken): string {
  return source.slice(token.start, token.start + token.length);
}
```

**Special tokens:**
- An error token (`TokenType.ERROR`) holds an error message in a separate field:
  ```typescript
  export interface VmErrorToken extends VmToken {
    type: TokenType.ERROR;
    message: string;
  }
  export type AnyVmToken = VmToken | VmErrorToken;
  ```

### `src/vm/Scanner.ts`

```typescript
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
```

---

## Tests to Write

Create `tests/vm/VmScanner.test.ts`:

```typescript
import { VmScanner } from '../../src/vm/Scanner';
import { TokenType } from '../../src/vm/TokenType';
import { getLexeme } from '../../src/vm/Token';

function scanAll(source: string) {
  const scanner = new VmScanner(source);
  const tokens = [];
  let token;
  do {
    token = scanner.scanToken();
    tokens.push(token);
  } while (token.type !== TokenType.EOF);
  return tokens;
}

describe('VmScanner', () => {
  it('scans empty input as EOF', () => {
    const scanner = new VmScanner('');
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.EOF);
  });

  it('scans a number', () => {
    const source = '123';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.NUMBER);
    expect(getLexeme(source, token)).toBe('123');
  });

  it('scans a decimal number', () => {
    const source = '3.14';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(getLexeme(source, token)).toBe('3.14');
  });

  it('scans a string', () => {
    const source = '"hello"';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.STRING);
    expect(getLexeme(source, token)).toBe('"hello"');
  });

  it('produces error token for unterminated string', () => {
    const scanner = new VmScanner('"unterminated');
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.ERROR);
  });

  it('scans all keywords correctly', () => {
    const keywords: [string, TokenType][] = [
      ['and', TokenType.AND], ['class', TokenType.CLASS],
      ['if', TokenType.IF], ['return', TokenType.RETURN],
    ];
    for (const [word, type] of keywords) {
      const scanner = new VmScanner(word);
      expect(scanner.scanToken().type).toBe(type);
    }
  });

  it('scans an identifier', () => {
    const source = 'myVar';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.IDENTIFIER);
    expect(getLexeme(source, token)).toBe('myVar');
  });

  it('skips line comments', () => {
    const tokens = scanAll('// comment\n123');
    expect(tokens[0].type).toBe(TokenType.NUMBER);
  });

  it('tracks line numbers', () => {
    const scanner = new VmScanner('1\n2');
    scanner.scanToken(); // 1
    scanner.scanToken(); // 2
    const tok2 = scanner.scanToken(); // should be '2' on line 2
    // Actually scan differently — let's check line tracking
    const s2 = new VmScanner('1\n2');
    s2.scanToken(); // tok on line 1
    const tok = s2.scanToken(); // tok on line 2
    expect(tok.line).toBe(2);
  });

  it('scans operators', () => {
    const tokens = scanAll('+ - * / ! != == < <= > >=');
    const types = tokens.slice(0, -1).map(t => t.type); // exclude EOF
    expect(types).toContain(TokenType.PLUS);
    expect(types).toContain(TokenType.BANG_EQUAL);
    expect(types).toContain(TokenType.EQUAL_EQUAL);
    expect(types).toContain(TokenType.LESS_EQUAL);
  });
});
```

---

## Acceptance Criteria

- [ ] All VM scanner tests pass
- [ ] `scanToken()` returns one token per call (on-demand, not batch)
- [ ] Error tokens use `TokenType.ERROR` with a `message` field
- [ ] Keywords are correctly identified
- [ ] String tokens include the surrounding quotes in their span (`getLexeme` returns `"hello"` with quotes)
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Unlike Part II's scanner, the VM scanner stores `start`/`length` into the original source string rather than copying lexeme strings. This avoids allocations during scanning.
- String token spans include the surrounding double-quote characters. The compiler will strip them when creating string values.
- Commit with message: `feat(vm): add on-demand scanner for bytecode compiler`
