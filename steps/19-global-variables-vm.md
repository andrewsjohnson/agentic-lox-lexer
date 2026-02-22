# Step 19 — Global Variables (VM)

**Book reference**: Chapter 21 — Global Variables
**Builds on**: Step 18 (hash tables)

---

## Overview

This step extends the VM compiler to handle **statements** and **global variables**.
After this step, `npm run clox` can run programs with `print`, `var`, and
assignment to global variables.

---

## New Opcodes

```
OP_PRINT           // pop top of stack and print it
OP_POP             // pop and discard top of stack (already added in Step 13)
OP_DEFINE_GLOBAL   // define a global variable
OP_GET_GLOBAL      // push the value of a global variable
OP_SET_GLOBAL      // assign to a global variable
```

`OP_DEFINE_GLOBAL`, `OP_GET_GLOBAL`, and `OP_SET_GLOBAL` each take a single
byte operand: an index into the constant pool where the variable name (string)
is stored.

---

## Grammar

The compiler now parses **declarations** and **statements**, not just expressions:

```
program     → declaration* EOF
declaration → varDecl | statement
statement   → exprStmt | printStmt
exprStmt    → expression ";"
printStmt   → "print" expression ";"
varDecl     → "var" IDENTIFIER ( "=" expression )? ";"
```

---

## What to Implement

### Update `src/vm/Compiler.ts`

Change the top-level `compile()` method to call `declaration()` in a loop:

```typescript
compile(source: string): Chunk | null {
  this.scanner = new VmScanner(source);
  this.chunk = new Chunk();
  this.advance();
  while (!this.check(TokenType.EOF)) {
    this.declaration();
  }
  this.consume(TokenType.EOF, 'Expect end of expression.');
  this.emitReturn();
  return this.hadError ? null : this.chunk;
}

private declaration(): void {
  if (this.match(TokenType.VAR)) {
    this.varDeclaration();
  } else {
    this.statement();
  }
  if (this.panicMode) this.synchronize();
}

private varDeclaration(): void {
  const global = this.parseVariable('Expect variable name.');
  if (this.match(TokenType.EQUAL)) {
    this.expression();
  } else {
    this.emitByte(OpCode.OP_NIL);
  }
  this.consume(TokenType.SEMICOLON, "Expect ';' after variable declaration.");
  this.defineVariable(global);
}

private parseVariable(errorMessage: string): number {
  this.consume(TokenType.IDENTIFIER, errorMessage);
  return this.identifierConstant(this.previous);
}

private identifierConstant(name: AnyVmToken): number {
  return this.makeConstant(getLexeme(this.source, name));
}

private defineVariable(global: number): void {
  this.emitBytes(OpCode.OP_DEFINE_GLOBAL, global);
}

private statement(): void {
  if (this.match(TokenType.PRINT)) {
    this.printStatement();
  } else {
    this.expressionStatement();
  }
}

private printStatement(): void {
  this.expression();
  this.consume(TokenType.SEMICOLON, "Expect ';' after value.");
  this.emitByte(OpCode.OP_PRINT);
}

private expressionStatement(): void {
  this.expression();
  this.consume(TokenType.SEMICOLON, "Expect ';' after expression.");
  this.emitByte(OpCode.OP_POP);
}
```

**Handle assignment in `expression()`:**

When parsing an identifier in `primary()`, also handle assignment expressions.
The `namedVariable()` helper:

```typescript
private namedVariable(name: AnyVmToken, canAssign: boolean): void {
  const arg = this.identifierConstant(name);
  if (canAssign && this.match(TokenType.EQUAL)) {
    this.expression();
    this.emitBytes(OpCode.OP_SET_GLOBAL, arg);
  } else {
    this.emitBytes(OpCode.OP_GET_GLOBAL, arg);
  }
}

private variable(canAssign: boolean): void {
  this.namedVariable(this.previous, canAssign);
}
```

Register `variable` as the prefix handler for `IDENTIFIER`.

**Synchronize on error:**

```typescript
private synchronize(): void {
  this.panicMode = false;
  while (this.current.type !== TokenType.EOF) {
    if (this.previous.type === TokenType.SEMICOLON) return;
    switch (this.current.type) {
      case TokenType.CLASS: case TokenType.FUN: case TokenType.VAR:
      case TokenType.FOR: case TokenType.IF: case TokenType.WHILE:
      case TokenType.PRINT: case TokenType.RETURN:
        return;
    }
    this.advance();
  }
}
```

### Update `src/vm/VM.ts`

Add a `globals: Table` field and implement the new opcodes:

```typescript
import { Table } from './Table';

class VM {
  private globals = new Table();

  // In run():
  case OpCode.OP_PRINT:
    console.log(printValue(this.pop()));
    break;

  case OpCode.OP_POP:
    this.pop();
    break;

  case OpCode.OP_DEFINE_GLOBAL: {
    const name = this.readConstant() as string;
    this.globals.set(name, this.peek(0));
    this.pop();
    break;
  }

  case OpCode.OP_GET_GLOBAL: {
    const name = this.readConstant() as string;
    const value = this.globals.get(name);
    if (value === undefined) {
      return this.runtimeError(`Undefined variable '${name}'.`);
    }
    this.push(value);
    break;
  }

  case OpCode.OP_SET_GLOBAL: {
    const name = this.readConstant() as string;
    if (this.globals.set(name, this.peek(0))) {
      // set() returns true for NEW keys — global wasn't defined
      this.globals.delete(name);
      return this.runtimeError(`Undefined variable '${name}'.`);
    }
    break;
  }
```

---

## Tests to Write

Create `tests/vm/GlobalVariables.test.ts`:

```typescript
import { VM, InterpretResult } from '../../src/vm/VM';

function run(source: string) { return new VM().interpretSource(source); }
function capture(source: string): string[] {
  const out: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...a) => out.push(a.join(' ')));
  new VM().interpretSource(source);
  spy.mockRestore();
  return out;
}

describe('Print statement in VM', () => {
  it('prints a number', () => expect(capture('print 42;')).toEqual(['42']));
  it('prints a string', () => expect(capture('print "hello";')).toEqual(['hello']));
  it('prints nil', () => expect(capture('print nil;')).toEqual(['nil']));
  it('prints true and false', () => {
    expect(capture('print true;')).toEqual(['true']);
    expect(capture('print false;')).toEqual(['false']);
  });
  it('prints 1.0 as "1"', () => expect(capture('print 1.0;')).toEqual(['1']));
});

describe('Global variable declaration', () => {
  it('declares and reads a variable', () => {
    expect(capture('var x = 10; print x;')).toEqual(['10']);
  });

  it('declares with no initializer (nil)', () => {
    expect(capture('var x; print x;')).toEqual(['nil']);
  });

  it('runtime error for undefined variable', () => {
    expect(run('print x;')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('Global variable assignment', () => {
  it('assigns a new value', () => {
    expect(capture('var x = 1; x = 2; print x;')).toEqual(['2']);
  });

  it('runtime error assigning to undeclared variable', () => {
    expect(run('x = 1;')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('Multiple statements', () => {
  it('executes sequentially', () => {
    expect(capture('print 1; print 2; print 3;')).toEqual(['1', '2', '3']);
  });
});

describe('Expression statements', () => {
  it('evaluates and discards expression result', () => {
    expect(run('1 + 2;')).toBe(InterpretResult.OK);
  });
});
```

Also update the skipped tests in `tests/vm/Strings.test.ts` — remove the `.skip`:

```typescript
it('prints a string', () => {
  expect(capture('print "hello";')).toEqual(['hello']);
});
it('prints concatenated string', () => {
  expect(capture('print "Hello, " + "world!";')).toEqual(['Hello, world!']);
});
```

---

## Acceptance Criteria

- [ ] All global variable and print tests pass
- [ ] `print expr;` works for all value types
- [ ] `var x = val;` defines global, `print x;` retrieves it
- [ ] `var x;` initializes to `nil`
- [ ] Assignment to undeclared global returns `RUNTIME_ERROR`
- [ ] Reading undefined global returns `RUNTIME_ERROR`
- [ ] Previously skipped string print tests now pass
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- `OP_DEFINE_GLOBAL` peeks at the top of stack (does NOT pop it before storing) then pops — or it pops and stores. Either is fine, but be consistent.
- `OP_SET_GLOBAL` does NOT pop after storing (the assignment expression's value stays on the stack — it may be used by outer expressions).
- The constant pool index for variable names uses the same `OP_CONSTANT`-style byte operand (single byte = max 256 global names per chunk — enough for now).
- Commit with message: `feat(vm): add global variables and print statement to VM compiler`
