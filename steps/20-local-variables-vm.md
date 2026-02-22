# Step 20 — Local Variables (VM)

**Book reference**: Chapter 22 — Local Variables
**Builds on**: Step 19 (global variables)

---

## Overview

Global variables are looked up by name at runtime (slow). **Local variables**
are stored directly on the value stack at known offsets — no hash table lookup
needed. The compiler resolves local variable positions statically.

This step adds:
- Local variable declaration and lookup (by stack slot index)
- Block scoping in the compiler
- `OP_GET_LOCAL` and `OP_SET_LOCAL` opcodes

---

## New Opcodes

```
OP_GET_LOCAL <slot>   // push stack[base + slot]
OP_SET_LOCAL <slot>   // stack[base + slot] = top of stack (don't pop)
```

---

## What to Implement

### Update `src/vm/Compiler.ts`

Add a `locals` array to the compiler to track local variables in the current scope:

```typescript
interface Local {
  name: AnyVmToken;
  depth: number;      // scope depth (-1 = declared but not initialized)
}

class Compiler {
  private locals: Local[] = [];
  private scopeDepth: number = 0;
```

**New methods:**

```typescript
private beginScope(): void {
  this.scopeDepth++;
}

private endScope(): void {
  this.scopeDepth--;
  // Pop all locals declared at the current scope depth
  while (this.locals.length > 0 &&
         this.locals[this.locals.length - 1].depth > this.scopeDepth) {
    this.emitByte(OpCode.OP_POP);
    this.locals.pop();
  }
}

private addLocal(name: AnyVmToken): void {
  if (this.locals.length >= 256) {
    this.error('Too many local variables in function.');
    return;
  }
  this.locals.push({ name, depth: -1 }); // depth -1 = declared, not ready
}

private declareVariable(): void {
  if (this.scopeDepth === 0) return; // global — handled by defineVariable
  const name = this.previous;
  // Check for existing variable with same name in current scope
  for (let i = this.locals.length - 1; i >= 0; i--) {
    const local = this.locals[i];
    if (local.depth !== -1 && local.depth < this.scopeDepth) break;
    if (getLexeme(this.source, local.name) === getLexeme(this.source, name)) {
      this.error("Already a variable with this name in this scope.");
    }
  }
  this.addLocal(name);
}

private markInitialized(): void {
  if (this.scopeDepth === 0) return;
  this.locals[this.locals.length - 1].depth = this.scopeDepth;
}

private resolveLocal(name: AnyVmToken): number {
  const lexeme = getLexeme(this.source, name);
  for (let i = this.locals.length - 1; i >= 0; i--) {
    const local = this.locals[i];
    if (getLexeme(this.source, local.name) === lexeme) {
      if (local.depth === -1) {
        this.error("Can't read local variable in its own initializer.");
      }
      return i;
    }
  }
  return -1; // not a local — try global
}
```

**Update `varDeclaration()`:**

```typescript
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

private defineVariable(global: number): void {
  if (this.scopeDepth > 0) {
    // Local variable — just mark as initialized (already on stack)
    this.markInitialized();
    return;
  }
  this.emitBytes(OpCode.OP_DEFINE_GLOBAL, global);
}
```

**Update `namedVariable()`:**

```typescript
private namedVariable(name: AnyVmToken, canAssign: boolean): void {
  let getOp: OpCode, setOp: OpCode;
  let arg = this.resolveLocal(name);

  if (arg !== -1) {
    getOp = OpCode.OP_GET_LOCAL;
    setOp = OpCode.OP_SET_LOCAL;
  } else {
    arg = this.identifierConstant(name);
    getOp = OpCode.OP_GET_GLOBAL;
    setOp = OpCode.OP_SET_GLOBAL;
  }

  if (canAssign && this.match(TokenType.EQUAL)) {
    this.expression();
    this.emitBytes(setOp, arg);
  } else {
    this.emitBytes(getOp, arg);
  }
}
```

**Add block statement parsing:**

```typescript
private block(): void {
  while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
    this.declaration();
  }
  this.consume(TokenType.RIGHT_BRACE, "Expect '}' after block.");
}
```

Update `statement()` to handle `{`:
```typescript
if (this.match(TokenType.LEFT_BRACE)) {
  this.beginScope();
  this.block();
  this.endScope();
}
```

### Update `src/vm/VM.ts`

Add `OP_GET_LOCAL` and `OP_SET_LOCAL`:

```typescript
case OpCode.OP_GET_LOCAL: {
  const slot = this.readByte();
  this.push(this.stack[this.callStack[this.callStack.length - 1].base + slot]);
  break;
}

case OpCode.OP_SET_LOCAL: {
  const slot = this.readByte();
  this.stack[this.callStack[this.callStack.length - 1].base + slot] = this.peek(0);
  // Don't pop — assignment is an expression
  break;
}
```

For now (before call frames in Step 22), use `slot` directly as an absolute
stack index (the call frame base is 0 for global code):

```typescript
case OpCode.OP_GET_LOCAL: {
  const slot = this.readByte();
  this.push(this.stack[slot]);
  break;
}

case OpCode.OP_SET_LOCAL: {
  const slot = this.readByte();
  this.stack[slot] = this.peek(0);
  break;
}
```

---

## Tests to Write

Create `tests/vm/LocalVariables.test.ts`:

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

describe('Local variable declarations', () => {
  it('declares and reads a local', () => {
    expect(capture('{ var x = 10; print x; }')).toEqual(['10']);
  });

  it('local with no initializer is nil', () => {
    expect(capture('{ var x; print x; }')).toEqual(['nil']);
  });

  it('local variable is destroyed at end of block', () => {
    // After the block, x shouldn't be visible globally
    expect(run('{ var x = 1; } print x;')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('Block scoping', () => {
  it('inner shadows outer', () => {
    expect(capture('{ var x = 1; { var x = 2; print x; } print x; }')).toEqual(['2', '1']);
  });

  it('inner scope can read outer local', () => {
    expect(capture('{ var x = 1; { print x; } }')).toEqual(['1']);
  });
});

describe('Local variable assignment', () => {
  it('assigns a new value to local', () => {
    expect(capture('{ var x = 1; x = 2; print x; }')).toEqual(['2']);
  });

  it('assignment result is an expression', () => {
    expect(capture('{ var x = 0; print (x = 5); }')).toEqual(['5']);
  });
});

describe('Mixed local and global', () => {
  it('local shadows global', () => {
    expect(capture('var x = "global"; { var x = "local"; print x; } print x;'))
      .toEqual(['local', 'global']);
  });
});

describe('Error cases', () => {
  it('duplicate variable in same scope is a compile error', () => {
    expect(run('{ var a = 1; var a = 2; }')).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('reading variable in its own initializer is an error', () => {
    expect(run('{ var a = a; }')).toBe(InterpretResult.COMPILE_ERROR);
  });
});
```

---

## Acceptance Criteria

- [ ] All local variable tests pass
- [ ] Locals are stored on the stack (by index, not by name lookup)
- [ ] Block scoping: local destroyed when block ends (OP_POP emitted)
- [ ] Inner scope correctly shadows outer scope
- [ ] Duplicate in same scope is a compile-time error
- [ ] Reading own initializer is a compile-time error
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Before call frames (Step 22), local slot 0 is the first position in the stack. After call frames, it's relative to the call frame base. Design with this in mind, or add a `frameBase` concept now.
- `OP_SET_LOCAL` does **not** pop the value — the assignment expression returns the assigned value.
- `endScope()` emits one `OP_POP` per local that goes out of scope — locals are values on the stack.
- Commit with message: `feat(vm): add local variables with block scoping to VM`
