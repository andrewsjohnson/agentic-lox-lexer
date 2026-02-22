# Step 22 — Calls and Functions (VM)

**Book reference**: Chapter 24 — Calls and Functions
**Builds on**: Step 21 (control flow)

---

## Overview

This is one of the most important steps in Part III. We add:
- **Function compilation** — a separate `Chunk` per function
- **Call frames** — each function call gets its own window into the stack
- **`OP_CALL`** and **`OP_RETURN`** working together
- **Native functions** (like `clock()`)

After this step, the VM can execute user-defined functions with arguments,
recursion, and native functions.

---

## Architecture: Call Frames

Instead of one flat stack, the VM uses a **call frame stack**. Each frame
represents one active function call and contains:
- A pointer to the `LoxFunction` being called
- The instruction pointer (`ip`) for that function's chunk
- The "base" index into the value stack where this frame's locals start

```typescript
interface CallFrame {
  fn: LoxFunction;   // (or closure in Step 23)
  ip: number;
  base: number;      // index of slot 0 for this call frame
}
```

The VM maintains a stack of `CallFrame` objects alongside the value stack.

---

## What to Implement

### `src/vm/VmFunction.ts`

A compiled Lox function:

```typescript
import { Chunk } from './Chunk';

export class VmFunction {
  readonly chunk: Chunk = new Chunk();
  arity: number = 0;
  name: string | null = null;

  toString(): string {
    return this.name ? `<fn ${this.name}>` : '<script>';
  }
}

export class VmNative {
  constructor(
    public readonly arity: number,
    public readonly fn: (...args: VmValue[]) => VmValue,
    public readonly name: string = '<native fn>',
  ) {}
  toString(): string { return `<native fn>`; }
}
```

Update `VmObject` in `Value.ts`:
```typescript
export interface VmObject {
  readonly type: 'function' | 'native' | 'closure' | 'upvalue' | 'class' | 'instance' | 'bound_method';
}
```

Or simplify: just use `VmFunction | VmNative | VmClosure | ...` directly in the `VmValue` union:
```typescript
export type VmValue = null | boolean | number | string | VmFunction | VmNative | VmClosure | ...;
```

### Update `src/vm/Compiler.ts`

Use a **nested compiler** model: each function compiles into its own `Compiler`
instance with its own `Chunk`. The outer compiler holds a stack of compilers:

```typescript
class FunctionCompiler {
  fn: VmFunction = new VmFunction();
  type: FunctionType = FunctionType.SCRIPT;
  locals: Local[] = [];
  scopeDepth: number = 0;
  enclosing: FunctionCompiler | null = null;
}
```

**Compile a function declaration:**

```typescript
private funDeclaration(): void {
  const global = this.parseVariable('Expect function name.');
  this.markInitialized(); // allow recursion
  this.function(FunctionType.FUNCTION);
  this.defineVariable(global);
}

private function(type: FunctionType): void {
  // Push a new FunctionCompiler context
  const fn = new VmFunction();
  fn.name = getLexeme(this.source, this.previous);
  // Compile params and body into fn.chunk
  this.consume(TokenType.LEFT_PAREN, "Expect '(' after function name.");
  if (!this.check(TokenType.RIGHT_PAREN)) {
    do {
      fn.arity++;
      if (fn.arity > 255) this.errorAtCurrent('...');
      const constant = this.parseVariable("Expect parameter name.");
      this.defineVariable(constant);
    } while (this.match(TokenType.COMMA));
  }
  this.consume(TokenType.RIGHT_PAREN, "Expect ')' after parameters.");
  this.consume(TokenType.LEFT_BRACE, "Expect '{' before function body.");
  this.block();
  // End: emit OP_NIL + OP_RETURN
  this.emitReturn();
  this.emitConstant(fn); // push the function object
}
```

**Return statement:**

```typescript
private returnStatement(): void {
  if (this.currentFunctionType === FunctionType.SCRIPT) {
    this.error("Can't return from top-level code.");
  }
  if (this.match(TokenType.SEMICOLON)) {
    this.emitReturn();
  } else {
    this.expression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after return value.");
    this.emitByte(OpCode.OP_RETURN);
  }
}

private emitReturn(): void {
  this.emitByte(OpCode.OP_NIL);
  this.emitByte(OpCode.OP_RETURN);
}
```

**Call expression in Pratt table:**
```typescript
private call(canAssign: boolean): void {
  const argCount = this.argumentList();
  this.emitBytes(OpCode.OP_CALL, argCount);
}

private argumentList(): number {
  let argCount = 0;
  if (!this.check(TokenType.RIGHT_PAREN)) {
    do {
      this.expression();
      if (argCount >= 255) this.error('...');
      argCount++;
    } while (this.match(TokenType.COMMA));
  }
  this.consume(TokenType.RIGHT_PAREN, "Expect ')' after arguments.");
  return argCount;
}
```

Register:
```typescript
[TokenType.LEFT_PAREN]: { prefix: this.grouping, infix: this.call, precedence: Precedence.CALL },
```

### Update `src/vm/VM.ts`

Replace the single flat execution loop with call-frame-aware execution:

```typescript
class VM {
  private stack: VmValue[] = [];
  private frames: CallFrame[] = [];

  private currentFrame(): CallFrame {
    return this.frames[this.frames.length - 1];
  }

  private readByte(): number {
    const frame = this.currentFrame();
    return frame.fn.chunk.code[frame.ip++];
  }

  private readConstant(): VmValue {
    const frame = this.currentFrame();
    return frame.fn.chunk.constants[this.readByte()];
  }

  // OP_CALL:
  case OpCode.OP_CALL: {
    const argCount = this.readByte();
    if (!this.callValue(this.peek(argCount), argCount)) {
      return InterpretResult.RUNTIME_ERROR;
    }
    break;
  }

  // OP_RETURN:
  case OpCode.OP_RETURN: {
    const result = this.pop();
    const frame = this.frames.pop()!;
    if (this.frames.length === 0) {
      this.pop(); // pop the script function itself
      return InterpretResult.OK;
    }
    // Discard the frame's slots
    this.stack.length = frame.base;
    this.push(result);
    break;
  }
```

```typescript
private callValue(callee: VmValue, argCount: number): boolean {
  if (callee instanceof VmFunction) {
    return this.call(callee, argCount);
  }
  if (callee instanceof VmNative) {
    const args = this.stack.slice(this.stack.length - argCount);
    const result = callee.fn(...args);
    this.stack.length -= argCount + 1;
    this.push(result);
    return true;
  }
  this.runtimeError('Can only call functions and classes.');
  return false;
}

private call(fn: VmFunction, argCount: number): boolean {
  if (argCount !== fn.arity) {
    this.runtimeError(`Expected ${fn.arity} arguments but got ${argCount}.`);
    return false;
  }
  if (this.frames.length >= 64) {
    this.runtimeError('Stack overflow.');
    return false;
  }
  this.frames.push({
    fn,
    ip: 0,
    base: this.stack.length - argCount - 1,
  });
  return true;
}
```

**Initialize the VM with a top-level function:**

```typescript
interpret(source: string): InterpretResult {
  const fn = compiler.compile(source);
  if (!fn) return InterpretResult.COMPILE_ERROR;
  this.push(fn);
  this.call(fn, 0);
  return this.run();
}
```

**Define native functions:**

```typescript
private defineNative(name: string, arity: number, fn: (...args: VmValue[]) => VmValue) {
  this.globals.set(name, new VmNative(arity, fn, name));
}

// In constructor:
this.defineNative('clock', 0, () => Date.now() / 1000);
```

**Update local variable access** to use `frame.base`:
```typescript
case OpCode.OP_GET_LOCAL: {
  const slot = this.readByte();
  this.push(this.stack[this.currentFrame().base + slot]);
  break;
}
case OpCode.OP_SET_LOCAL: {
  const slot = this.readByte();
  this.stack[this.currentFrame().base + slot] = this.peek(0);
  break;
}
```

---

## Tests to Write

Create `tests/vm/Functions.test.ts`:

```typescript
describe('Function declaration and call', () => {
  it('calls a simple function', () => {
    expect(capture('fun greet() { print "hi"; } greet();')).toEqual(['hi']);
  });
  it('function with parameters', () => {
    expect(capture('fun add(a, b) { print a + b; } add(1, 2);')).toEqual(['3']);
  });
  it('function returns a value', () => {
    expect(capture('fun double(x) { return x * 2; } print double(5);')).toEqual(['10']);
  });
  it('function with no return returns nil', () => {
    expect(capture('fun noop() {} print noop();')).toEqual(['nil']);
  });
  it('bare return returns nil', () => {
    expect(capture('fun early() { return; } print early();')).toEqual(['nil']);
  });
});

describe('Recursion', () => {
  it('computes fibonacci', () => {
    expect(capture(`
      fun fib(n) {
        if (n <= 1) return n;
        return fib(n - 2) + fib(n - 1);
      }
      print fib(8);
    `)).toEqual(['21']);
  });
});

describe('Native functions', () => {
  it('clock() returns a number', () => {
    const out = capture('print clock();');
    expect(Number(out[0])).toBeGreaterThan(0);
  });
});

describe('Function errors', () => {
  it('calling a non-callable is a runtime error', () => {
    expect(run('var x = 1; x();')).toBe(InterpretResult.RUNTIME_ERROR);
  });
  it('wrong argument count is a runtime error', () => {
    expect(run('fun f(a) {} f(1, 2);')).toBe(InterpretResult.RUNTIME_ERROR);
  });
  it('return from top-level is a compile error', () => {
    expect(run('return 1;')).toBe(InterpretResult.COMPILE_ERROR);
  });
});

describe('Function as value', () => {
  it('functions can be assigned and called via variable', () => {
    expect(capture('fun sq(x) { return x * x; } var f = sq; print f(4);')).toEqual(['16']);
  });
});
```

---

## Acceptance Criteria

- [ ] All function tests pass
- [ ] Functions compile into their own `Chunk`
- [ ] Call frames correctly isolate each function's locals
- [ ] Recursion works (stack grows with each call, shrinks on return)
- [ ] Native `clock()` function works
- [ ] Arity mismatch → runtime error
- [ ] Top-level `return` → compile error
- [ ] No TypeScript errors
- [ ] All previous tests still pass (local variable slot offsets still work)

---

## Notes

- The top-level script is itself compiled into a `VmFunction` (an implicit main function with arity 0). The compiler wraps everything in this script function.
- The first slot in each call frame (`base + 0`) is reserved for the function itself (for closures/methods). This means parameter 0 is at `base + 1`.
- Stack overflow is 64 frames deep — check in `call()`.
- Commit with message: `feat(vm): add functions and call frames to VM`
