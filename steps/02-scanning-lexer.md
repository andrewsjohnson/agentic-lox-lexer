# Step 02 — Scanning (Lexer)

**Book reference**: Chapter 4 — Scanning
**Builds on**: Step 01 (project setup)

---

## Overview

The scanner (also called a lexer) is the first phase of the interpreter. It
takes raw source text and converts it into a flat list of **tokens**. A token
is a pair of (type, value) with an associated source line number.

After this step you will have:
- A `TokenType` enum covering all Lox token types
- A `Token` class holding type, lexeme, literal value, and line number
- A `Scanner` class that transforms a source string into `Token[]`

---

## What to Implement

### `src/lox/TokenType.ts`

Define an enum (or const object) with every Lox token type:

```
// Single-character tokens
LEFT_PAREN, RIGHT_PAREN, LEFT_BRACE, RIGHT_BRACE,
COMMA, DOT, MINUS, PLUS, SEMICOLON, SLASH, STAR,

// One or two character tokens
BANG, BANG_EQUAL,
EQUAL, EQUAL_EQUAL,
GREATER, GREATER_EQUAL,
LESS, LESS_EQUAL,

// Literals
IDENTIFIER, STRING, NUMBER,

// Keywords
AND, CLASS, ELSE, FALSE, FUN, FOR, IF, NIL, OR,
PRINT, RETURN, SUPER, THIS, TRUE, VAR, WHILE,

// Special
EOF
```

### `src/lox/Token.ts`

```typescript
import { TokenType } from './TokenType';

export class Token {
  constructor(
    public readonly type: TokenType,
    public readonly lexeme: string,
    public readonly literal: unknown,  // null | number | string | boolean
    public readonly line: number,
  ) {}

  toString(): string {
    return `${this.type} ${this.lexeme} ${this.literal}`;
  }
}
```

### `src/lox/Scanner.ts`

The `Scanner` class takes a `source: string` in its constructor and exposes a
single public method `scanTokens(): Token[]`.

**Implementation requirements:**

1. **Single-character tokens**: `(`, `)`, `{`, `}`, `,`, `.`, `-`, `+`, `;`, `*`
2. **One-or-two character tokens**: `!`, `!=`, `=`, `==`, `>`, `>=`, `<`, `<=`
3. **Comments**: `//` starts a line comment; skip until newline (do not tokenize)
4. **Whitespace**: skip spaces, tabs, carriage returns; increment line on `\n`
5. **String literals**: delimited by `"..."`. Support multi-line strings.
   Unterminated strings should report an error (store in an error list, do not throw).
6. **Number literals**: integers and decimals (`123`, `45.67`). No leading dot, no trailing dot.
7. **Identifiers and keywords**: read alphanumeric sequences; check against a
   keyword map to emit the correct keyword token type vs `IDENTIFIER`.
8. **EOF**: always append an `EOF` token at the end.

**Error handling**: Instead of throwing exceptions, the scanner should collect
errors. Expose a `errors: string[]` property. Callers check this after scanning.

**Keyword map** (must be exact):
```
and, class, else, false, for, fun, if, nil, or,
print, return, super, this, true, var, while
```

---

## Tests to Write

Create `tests/lox/Scanner.test.ts`:

```typescript
import { Scanner } from '../../src/lox/Scanner';
import { TokenType } from '../../src/lox/TokenType';

describe('Scanner', () => {
  describe('single-character tokens', () => {
    it('scans left and right parens', () => { ... });
    it('scans braces', () => { ... });
    it('scans arithmetic operators', () => { ... });
    it('scans dot, comma, semicolon', () => { ... });
  });

  describe('one-or-two character tokens', () => {
    it('scans ! and !=', () => { ... });
    it('scans = and ==', () => { ... });
    it('scans < and <=', () => { ... });
    it('scans > and >=', () => { ... });
  });

  describe('literals', () => {
    it('scans a string literal', () => {
      // "hello" => STRING token with literal "hello"
    });
    it('scans a multi-line string', () => {
      // "line1\nline2" => STRING, line count advances
    });
    it('reports error for unterminated string', () => {
      // "unterminated => errors.length > 0
    });
    it('scans integer number', () => {
      // 123 => NUMBER token with literal 123
    });
    it('scans decimal number', () => {
      // 45.67 => NUMBER token with literal 45.67
    });
  });

  describe('keywords', () => {
    it('recognizes all keywords', () => {
      const keywords = ['and','class','else','false','for','fun','if',
                        'nil','or','print','return','super','this','true',
                        'var','while'];
      // Each keyword must produce the correct TokenType, not IDENTIFIER
    });
    it('treats unknown words as identifiers', () => {
      // "foobar" => IDENTIFIER
    });
  });

  describe('comments', () => {
    it('ignores line comments', () => {
      // "// this is a comment\n1" => only NUMBER and EOF
    });
  });

  describe('whitespace', () => {
    it('increments line number on newline', () => {
      // scan "1\n2", second token is on line 2
    });
    it('skips spaces and tabs', () => {
      // "  1  " => NUMBER and EOF
    });
  });

  describe('EOF', () => {
    it('always appends EOF token', () => {
      const scanner = new Scanner('');
      const tokens = scanner.scanTokens();
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
  });

  describe('complex expressions', () => {
    it('scans a full expression', () => {
      // "1 + 2 * (3 - 4)" => 9 tokens + EOF
    });
    it('scans a print statement', () => {
      // 'print "hello";' => PRINT, STRING, SEMICOLON, EOF
    });
  });
});
```

Fill in each test body with real assertions. Every `it(...)` must have at least
one `expect(...)` assertion.

---

## Acceptance Criteria

- [ ] All scanner tests pass (`npm test -- --testPathPattern="Scanner"`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] `src/lox/TokenType.ts`, `src/lox/Token.ts`, and `src/lox/Scanner.ts` exist
- [ ] Scanner correctly handles all token types listed above
- [ ] Scanner does not throw on errors — it collects them in `errors[]`

---

## Notes

- The book uses Java's `charAt()` and `substring()`; use TypeScript string indexing (`source[i]`) and `source.slice(start, end)`.
- Store the `start` and `current` cursor positions as instance fields.
- The `literal` field of `Token` is `null` for non-literal tokens, a `number` for `NUMBER` tokens, and a `string` for `STRING` tokens (the raw string content without surrounding quotes).
- Commit with message: `feat(lox): implement scanner with all token types`
