# Step 15 — Compiling Expressions

**Book reference**: Chapter 17 — Compiling Expressions
**Builds on**: Step 14 (on-demand scanner)

---

## Overview

This step connects the VM scanner to a **single-pass compiler** that emits
bytecode directly — without building an AST first. The compiler uses a
**Pratt parser** (top-down operator precedence) to parse and compile expressions
in one pass.

After this step, `npm run clox` will compile and run simple arithmetic Lox expressions.

---

## Pratt Parsing

A Pratt parser associates each token type with:
- **Prefix parse function** — what to do when the token appears at the start of an expression (e.g., `(`, `-`, a number literal)
- **Infix parse function** — what to do when the token appears in the middle of an expression after a left operand (e.g., `+`, `*`, `==`)
- **Precedence level** — how tightly the operator binds

```typescript
export enum Precedence {
  NONE,
  ASSIGNMENT,   // =
  OR,           // or
  AND,          // and
  EQUALITY,     // == !=
  COMPARISON,   // < > <= >=
  TERM,         // + -
  FACTOR,       // * /
  UNARY,        // ! -
  CALL,         // . ()
  PRIMARY,
}
```

---

## What to Implement

### `src/vm/Compiler.ts`

```typescript
type ParseFn = (canAssign: boolean) => void;

interface ParseRule {
  prefix: ParseFn | null;
  infix:  ParseFn | null;
  precedence: Precedence;
}
```

**Key methods:**

```typescript
class Compiler {
  private scanner: VmScanner;
  private current: AnyVmToken;
  private previous: AnyVmToken;
  private hadError: boolean = false;
  private panicMode: boolean = false;
  private chunk: Chunk;

  compile(source: string): Chunk | null {
    this.scanner = new VmScanner(source);
    this.chunk = new Chunk();
    this.advance();
    this.expression();
    this.consume(TokenType.EOF, 'Expect end of expression.');
    this.emitReturn();
    return this.hadError ? null : this.chunk;
  }

  private expression(): void {
    this.parsePrecedence(Precedence.ASSIGNMENT);
  }

  private parsePrecedence(precedence: Precedence): void {
    this.advance();
    const prefixRule = this.getRule(this.previous.type).prefix;
    if (!prefixRule) {
      this.error('Expect expression.');
      return;
    }
    const canAssign = precedence <= Precedence.ASSIGNMENT;
    prefixRule(canAssign);

    while (precedence <= this.getRule(this.current.type).precedence) {
      this.advance();
      const infixRule = this.getRule(this.previous.type).infix!;
      infixRule(canAssign);
    }
  }

  // Parse functions (bound as arrow functions or using .bind(this)):
  private number(): void {
    const value = parseFloat(getLexeme(this.source, this.previous));
    this.emitConstant(value);
  }

  private grouping(): void {
    this.expression();
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.");
  }

  private unary(): void {
    const operatorType = this.previous.type;
    this.parsePrecedence(Precedence.UNARY);
    switch (operatorType) {
      case TokenType.MINUS: this.emitByte(OpCode.OP_NEGATE); break;
      case TokenType.BANG:  this.emitByte(OpCode.OP_NOT);    break;
    }
  }

  private binary(): void {
    const operatorType = this.previous.type;
    const rule = this.getRule(operatorType);
    this.parsePrecedence(rule.precedence + 1);
    switch (operatorType) {
      case TokenType.PLUS:          this.emitByte(OpCode.OP_ADD);      break;
      case TokenType.MINUS:         this.emitByte(OpCode.OP_SUBTRACT); break;
      case TokenType.STAR:          this.emitByte(OpCode.OP_MULTIPLY); break;
      case TokenType.SLASH:         this.emitByte(OpCode.OP_DIVIDE);   break;
      case TokenType.BANG_EQUAL:    this.emitBytes(OpCode.OP_EQUAL, OpCode.OP_NOT); break;
      case TokenType.EQUAL_EQUAL:   this.emitByte(OpCode.OP_EQUAL);    break;
      case TokenType.GREATER:       this.emitByte(OpCode.OP_GREATER);  break;
      case TokenType.GREATER_EQUAL: this.emitBytes(OpCode.OP_LESS, OpCode.OP_NOT);  break;
      case TokenType.LESS:          this.emitByte(OpCode.OP_LESS);     break;
      case TokenType.LESS_EQUAL:    this.emitBytes(OpCode.OP_GREATER, OpCode.OP_NOT); break;
    }
  }

  private literal(): void {
    switch (this.previous.type) {
      case TokenType.FALSE: this.emitByte(OpCode.OP_FALSE); break;
      case TokenType.NIL:   this.emitByte(OpCode.OP_NIL);   break;
      case TokenType.TRUE:  this.emitByte(OpCode.OP_TRUE);  break;
    }
  }
}
```

**Parse rules table** — a `Map<TokenType, ParseRule>` that maps every token
type to its prefix/infix handler and precedence. Define as a static lookup:

```typescript
private getRule(type: TokenType): ParseRule {
  return rules[type] ?? { prefix: null, infix: null, precedence: Precedence.NONE };
}
```

**Emission helpers:**
```typescript
private emitByte(byte: number): void {
  this.chunk.write(byte, this.previous.line);
}
private emitBytes(b1: number, b2: number): void {
  this.emitByte(b1); this.emitByte(b2);
}
private emitReturn(): void {
  this.emitByte(OpCode.OP_RETURN);
}
private emitConstant(value: VmValue): void {
  const idx = this.chunk.addConstant(value);
  if (idx > 255) { this.error('Too many constants in one chunk.'); return; }
  this.emitBytes(OpCode.OP_CONSTANT, idx);
}
```

**Error handling:**
```typescript
private error(message: string): void {
  this.errorAt(this.previous, message);
}
private errorAtCurrent(message: string): void {
  this.errorAt(this.current, message);
}
private errorAt(token: AnyVmToken, message: string): void {
  if (this.panicMode) return;
  this.panicMode = true;
  // Print error to stderr
  console.error(`[line ${token.line}] Error: ${message}`);
  this.hadError = true;
}
```

### Update `src/vm/VM.ts`

Integrate the compiler:

```typescript
interpretSource(source: string): InterpretResult {
  const compiler = new Compiler();
  const chunk = compiler.compile(source);
  if (!chunk) return InterpretResult.COMPILE_ERROR;
  return this.interpret(chunk);
}
```

### Update `src/vm/Clox.ts`

Wire up the REPL / file runner using `vm.interpretSource(source)`.

---

## Tests to Write

Create `tests/vm/Compiler.test.ts`:

```typescript
import { VM, InterpretResult } from '../../src/vm/VM';

function run(source: string): InterpretResult {
  return new VM().interpretSource(source);
}

function runCapture(source: string): string[] {
  const output: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...a) => output.push(a.join(' ')));
  new VM().interpretSource(source);
  spy.mockRestore();
  return output;
}

describe('Compiler — literals', () => {
  it('compiles true', () => expect(run('true')).toBe(InterpretResult.OK));
  it('compiles false', () => expect(run('false')).toBe(InterpretResult.OK));
  it('compiles nil', () => expect(run('nil')).toBe(InterpretResult.OK));
  it('compiles a number', () => expect(run('42')).toBe(InterpretResult.OK));
});

describe('Compiler — arithmetic', () => {
  it('compiles 1 + 2', () => expect(run('1 + 2')).toBe(InterpretResult.OK));
  it('compiles 2 * 3 + 4', () => expect(run('2 * 3 + 4')).toBe(InterpretResult.OK));
  it('compiles -(1 + 2)', () => expect(run('-(1 + 2)')).toBe(InterpretResult.OK));
});

describe('Compiler — comparison', () => {
  it('compiles 1 < 2', () => expect(run('1 < 2')).toBe(InterpretResult.OK));
  it('compiles 1 == 1', () => expect(run('1 == 1')).toBe(InterpretResult.OK));
  it('compiles 1 != 2', () => expect(run('1 != 2')).toBe(InterpretResult.OK));
});

describe('Compiler — print statement', () => {
  it('prints a number via print statement', () => {
    // Note: print is a statement — we need to extend the compiler in Step 19
    // For now, test expression evaluation is correct
    expect(run('1 + 2')).toBe(InterpretResult.OK);
  });
});

describe('Compiler — errors', () => {
  it('returns COMPILE_ERROR for invalid syntax', () => {
    expect(run('1 +')).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('returns COMPILE_ERROR for unclosed paren', () => {
    expect(run('(1 + 2')).toBe(InterpretResult.COMPILE_ERROR);
  });
});
```

---

## Acceptance Criteria

- [ ] All compiler tests pass
- [ ] The Pratt parser correctly handles precedence (multiplication before addition)
- [ ] `>=` is compiled as `OP_LESS + OP_NOT` (not a separate opcode)
- [ ] `!=` is compiled as `OP_EQUAL + OP_NOT`
- [ ] Compile errors return `InterpretResult.COMPILE_ERROR` (not thrown)
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The parse rules table is typically a static array indexed by `TokenType`. In TypeScript, use a `Record<TokenType, ParseRule>` or a `Map`.
- Bind parse functions carefully: they need access to `this`. Use arrow functions in the rules table or `.bind(this)` when registering them.
- The compiler does **not** yet handle statements (`print`, `var`, etc.) — that comes in Steps 19–21. Currently it compiles single expressions.
- Commit with message: `feat(vm): implement Pratt parser compiler for expressions`
