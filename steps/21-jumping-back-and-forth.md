# Step 21 — Jumping Back and Forth

**Book reference**: Chapter 23 — Jumping Back and Forth
**Builds on**: Step 20 (local variables)

---

## Overview

This step adds **control flow** to the bytecode VM: conditional jumps (for
`if`/`else` and logical operators), and backward jumps (for loops).

---

## New Opcodes

```
OP_JUMP            <offset16>   // unconditional forward jump
OP_JUMP_IF_FALSE   <offset16>   // jump if top of stack is falsy (don't pop)
OP_LOOP            <offset16>   // jump backward (for loops)
```

Offsets are **16-bit** (two bytes) so we can jump up to 65535 bytes forward/backward.

---

## Patching (Backpatching)

For `if` statements, we don't know the jump target when we emit the jump
instruction (because we haven't compiled the body yet). Use **backpatching**:

1. Emit the jump instruction with a placeholder offset (`0xFF, 0xFF`)
2. Compile the body
3. Go back and patch the placeholder with the actual offset

```typescript
private emitJump(instruction: OpCode): number {
  this.emitByte(instruction);
  this.emitByte(0xff); // placeholder high byte
  this.emitByte(0xff); // placeholder low byte
  return this.chunk.code.length - 2; // offset of the placeholder
}

private patchJump(offset: number): void {
  const jump = this.chunk.code.length - offset - 2;
  if (jump > 0xffff) {
    this.error('Too much code to jump over.');
  }
  this.chunk.code[offset]     = (jump >> 8) & 0xff;
  this.chunk.code[offset + 1] = jump & 0xff;
}
```

---

## What to Implement

### Update `src/vm/Compiler.ts`

**If statement:**

```typescript
private ifStatement(): void {
  this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'if'.");
  this.expression();
  this.consume(TokenType.RIGHT_PAREN, "Expect ')' after condition.");

  const thenJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE);
  this.emitByte(OpCode.OP_POP); // pop condition if truthy
  this.statement();

  const elseJump = this.emitJump(OpCode.OP_JUMP);
  this.patchJump(thenJump);
  this.emitByte(OpCode.OP_POP); // pop condition if falsy

  if (this.match(TokenType.ELSE)) this.statement();
  this.patchJump(elseJump);
}
```

**While loop:**

```typescript
private whileStatement(): void {
  const loopStart = this.chunk.code.length;
  this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'while'.");
  this.expression();
  this.consume(TokenType.RIGHT_PAREN, "Expect ')' after condition.");

  const exitJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE);
  this.emitByte(OpCode.OP_POP);
  this.statement();
  this.emitLoop(loopStart);

  this.patchJump(exitJump);
  this.emitByte(OpCode.OP_POP);
}

private emitLoop(loopStart: number): void {
  this.emitByte(OpCode.OP_LOOP);
  const offset = this.chunk.code.length - loopStart + 2;
  if (offset > 0xffff) this.error('Loop body too large.');
  this.emitByte((offset >> 8) & 0xff);
  this.emitByte(offset & 0xff);
}
```

**For loop:**

```typescript
private forStatement(): void {
  this.beginScope();
  this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'for'.");

  // Initializer clause
  if (this.match(TokenType.SEMICOLON)) {
    // No initializer
  } else if (this.match(TokenType.VAR)) {
    this.varDeclaration();
  } else {
    this.expressionStatement();
  }

  let loopStart = this.chunk.code.length;
  let exitJump = -1;

  // Condition clause
  if (!this.match(TokenType.SEMICOLON)) {
    this.expression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after loop condition.");
    exitJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE);
    this.emitByte(OpCode.OP_POP);
  }

  // Increment clause (jump over it, emit body, then loop back to increment)
  if (!this.match(TokenType.RIGHT_PAREN)) {
    const bodyJump = this.emitJump(OpCode.OP_JUMP);
    const incrementStart = this.chunk.code.length;
    this.expression();
    this.emitByte(OpCode.OP_POP);
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after for clauses.");
    this.emitLoop(loopStart);
    loopStart = incrementStart;
    this.patchJump(bodyJump);
  }

  this.statement();
  this.emitLoop(loopStart);

  if (exitJump !== -1) {
    this.patchJump(exitJump);
    this.emitByte(OpCode.OP_POP);
  }
  this.endScope();
}
```

**Logical operators** (`and`, `or`) with short-circuit:

```typescript
private and(canAssign: boolean): void {
  const endJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE);
  this.emitByte(OpCode.OP_POP);
  this.parsePrecedence(Precedence.AND);
  this.patchJump(endJump);
}

private or(canAssign: boolean): void {
  const elseJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE);
  const endJump  = this.emitJump(OpCode.OP_JUMP);
  this.patchJump(elseJump);
  this.emitByte(OpCode.OP_POP);
  this.parsePrecedence(Precedence.OR);
  this.patchJump(endJump);
}
```

Register `and` and `or` in parse rules:
```typescript
[TokenType.AND]: { prefix: null, infix: this.and, precedence: Precedence.AND },
[TokenType.OR]:  { prefix: null, infix: this.or,  precedence: Precedence.OR  },
```

### Update `src/vm/VM.ts`

```typescript
case OpCode.OP_JUMP: {
  const offset = this.readShort();
  this.ip += offset;
  break;
}

case OpCode.OP_JUMP_IF_FALSE: {
  const offset = this.readShort();
  if (!this.isTruthy(this.peek(0))) this.ip += offset;
  break;
}

case OpCode.OP_LOOP: {
  const offset = this.readShort();
  this.ip -= offset;
  break;
}
```

Add a helper:
```typescript
private readShort(): number {
  const hi = this.chunk.code[this.ip++];
  const lo = this.chunk.code[this.ip++];
  return (hi << 8) | lo;
}
```

---

## Tests to Write

Create `tests/vm/ControlFlow.test.ts`:

```typescript
function capture(source: string): string[] { /* same as before */ }
function run(source: string): InterpretResult { /* same as before */ }

describe('if/else in VM', () => {
  it('executes then branch', () => {
    expect(capture('if (true) print "yes";')).toEqual(['yes']);
  });
  it('skips then when false', () => {
    expect(capture('if (false) print "yes";')).toEqual([]);
  });
  it('executes else', () => {
    expect(capture('if (false) print "yes"; else print "no";')).toEqual(['no']);
  });
  it('nested if/else', () => {
    expect(capture('if (true) { if (false) print "a"; else print "b"; }')).toEqual(['b']);
  });
});

describe('while loop in VM', () => {
  it('loops 3 times', () => {
    expect(capture('var i = 0; while (i < 3) { print i; i = i + 1; }')).toEqual(['0', '1', '2']);
  });
  it('does not execute if condition is initially false', () => {
    expect(capture('while (false) print "x";')).toEqual([]);
  });
});

describe('for loop in VM', () => {
  it('basic for loop', () => {
    expect(capture('for (var i = 0; i < 3; i = i + 1) print i;')).toEqual(['0', '1', '2']);
  });
  it('for with no initializer', () => {
    expect(capture('var i = 0; for (; i < 2; i = i + 1) print i;')).toEqual(['0', '1']);
  });
  it('for with no increment', () => {
    expect(capture('for (var i = 0; i < 2;) { print i; i = i + 1; }')).toEqual(['0', '1']);
  });
});

describe('logical operators in VM', () => {
  it('and with both truthy returns right', () => {
    expect(capture('print 1 and 2;')).toEqual(['2']);
  });
  it('and short-circuits on false', () => {
    expect(capture('print false and "never";')).toEqual(['false']);
  });
  it('or with truthy left returns left', () => {
    expect(capture('print "yes" or "no";')).toEqual(['yes']);
  });
  it('or with false left returns right', () => {
    expect(capture('print false or "fallback";')).toEqual(['fallback']);
  });
});
```

---

## Acceptance Criteria

- [ ] All control flow tests pass
- [ ] Jump offsets are two bytes (can handle up to 65535 bytes)
- [ ] `OP_JUMP_IF_FALSE` does NOT pop the condition (the `if` statement emits `OP_POP` separately)
- [ ] `and`/`or` correctly short-circuit
- [ ] `for` loop correctly handles all three optional clauses
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Backpatching is the critical technique here. Emit the jump with dummy offsets, compile the body, then patch the offset. This is a fundamental compiler technique.
- `OP_JUMP_IF_FALSE` peeks at the stack (doesn't pop) — the `if`/`while` code emits `OP_POP` after the jump target, in both branches, to clean up the condition.
- For the `or` operator, if the left operand is truthy, jump over the pop and the right operand evaluation — leaving the left value on the stack.
- Commit with message: `feat(vm): add control flow jumps and loops to VM`
