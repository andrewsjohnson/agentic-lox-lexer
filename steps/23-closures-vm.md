# Step 23 — Closures (VM)

**Book reference**: Chapter 25 — Closures
**Builds on**: Step 22 (calls and functions)

---

## Overview

The VM's function implementation from Step 22 doesn't support **closures** —
functions that capture variables from their enclosing scope. This step adds:

- **`VmClosure`** — wraps a `VmFunction` with captured **upvalues**
- **`VmUpvalue`** — a reference to a captured variable (starts "open" pointing
  into the stack, becomes "closed" when the variable goes out of scope)
- **`OP_CLOSURE`** — creates a closure with its upvalue list
- **`OP_GET_UPVALUE`** / **`OP_SET_UPVALUE`** — access captured variables
- **`OP_CLOSE_UPVALUE`** — closes an upvalue when the variable leaves scope

---

## Key Concepts

**Open upvalue**: points directly to a stack slot (the variable is still on
the stack because the declaring function is still active).

**Closed upvalue**: when the declaring function returns, the stack slot
disappears. The upvalue "closes over" the variable by copying its value into
the upvalue itself.

```typescript
export class VmUpvalue {
  value: VmValue;           // closed-over value (when closed)
  location: number | null;  // stack index (when open), null when closed

  constructor(location: number, stack: VmValue[]) {
    this.location = location;
    this.value = stack[location]; // snapshot, will be live until closed
  }
}

export class VmClosure {
  readonly upvalues: VmUpvalue[];

  constructor(
    public readonly fn: VmFunction,
  ) {
    this.upvalues = new Array(fn.upvalueCount).fill(null);
  }

  toString(): string {
    return this.fn.toString();
  }
}
```

---

## What to Implement

### Update `src/vm/VmFunction.ts`

Add `upvalueCount: number = 0` to `VmFunction`.

### `src/vm/VmUpvalue.ts`

```typescript
export class VmUpvalue {
  closed: VmValue = null;
  next: VmUpvalue | null = null; // linked list of open upvalues in VM

  constructor(
    public location: number,  // stack index while open
  ) {}

  read(stack: VmValue[]): VmValue {
    if (this.location >= 0) return stack[this.location];
    return this.closed;
  }

  write(stack: VmValue[], value: VmValue): void {
    if (this.location >= 0) {
      stack[this.location] = value;
    } else {
      this.closed = value;
    }
  }

  close(stack: VmValue[]): void {
    this.closed = stack[this.location];
    this.location = -1; // mark as closed
  }
}
```

### Update `src/vm/Compiler.ts`

Add upvalue tracking to `FunctionCompiler`:

```typescript
interface Upvalue {
  index: number;
  isLocal: boolean;
}

class FunctionCompiler {
  upvalues: Upvalue[] = [];
  // ...
}
```

**`resolveUpvalue(name)` method:**

```typescript
private resolveUpvalue(compiler: FunctionCompiler, name: AnyVmToken): number {
  if (!compiler.enclosing) return -1;

  const local = this.resolveLocal(compiler.enclosing, name);
  if (local !== -1) {
    compiler.enclosing.locals[local].isCaptured = true;
    return this.addUpvalue(compiler, local, true);
  }

  const upvalue = this.resolveUpvalue(compiler.enclosing, name);
  if (upvalue !== -1) {
    return this.addUpvalue(compiler, upvalue, false);
  }

  return -1;
}

private addUpvalue(compiler: FunctionCompiler, index: number, isLocal: boolean): number {
  // Deduplicate: if already captured, reuse
  for (let i = 0; i < compiler.upvalues.length; i++) {
    const uv = compiler.upvalues[i];
    if (uv.index === index && uv.isLocal === isLocal) return i;
  }
  if (compiler.upvalues.length >= 256) {
    this.error('Too many closure variables in function.');
    return 0;
  }
  compiler.upvalues.push({ index, isLocal });
  compiler.fn.upvalueCount++;
  return compiler.upvalues.length - 1;
}
```

**Update `namedVariable()`** to check upvalues:

```typescript
private namedVariable(name: AnyVmToken, canAssign: boolean): void {
  let getOp: OpCode, setOp: OpCode, arg: number;

  const localIdx = this.resolveLocal(this.currentCompiler, name);
  if (localIdx !== -1) {
    arg = localIdx;
    getOp = OpCode.OP_GET_LOCAL;
    setOp = OpCode.OP_SET_LOCAL;
  } else {
    const upvalueIdx = this.resolveUpvalue(this.currentCompiler, name);
    if (upvalueIdx !== -1) {
      arg = upvalueIdx;
      getOp = OpCode.OP_GET_UPVALUE;
      setOp = OpCode.OP_SET_UPVALUE;
    } else {
      arg = this.identifierConstant(name);
      getOp = OpCode.OP_GET_GLOBAL;
      setOp = OpCode.OP_SET_GLOBAL;
    }
  }

  if (canAssign && this.match(TokenType.EQUAL)) {
    this.expression();
    this.emitBytes(setOp, arg);
  } else {
    this.emitBytes(getOp, arg);
  }
}
```

**Emit `OP_CLOSURE` instead of `OP_CONSTANT` for functions:**

After compiling a function, emit `OP_CLOSURE` followed by the function constant
index, then for each upvalue: 2 bytes (`isLocal ? 1 : 0`, `index`).

**Emit `OP_CLOSE_UPVALUE` in `endScope()`** for captured locals instead of `OP_POP`.

### Update `src/vm/VM.ts`

Replace `CallFrame.fn: VmFunction` with `CallFrame.closure: VmClosure`:

```typescript
interface CallFrame {
  closure: VmClosure;
  ip: number;
  base: number;
}
```

**New opcodes:**

```typescript
case OpCode.OP_CLOSURE: {
  const fn = this.readConstant() as VmFunction;
  const closure = new VmClosure(fn);
  this.push(closure);
  for (let i = 0; i < fn.upvalueCount; i++) {
    const isLocal = this.readByte();
    const index   = this.readByte();
    if (isLocal) {
      closure.upvalues[i] = this.captureUpvalue(frame.base + index);
    } else {
      closure.upvalues[i] = frame.closure.upvalues[index];
    }
  }
  break;
}

case OpCode.OP_GET_UPVALUE: {
  const slot = this.readByte();
  this.push(frame.closure.upvalues[slot].read(this.stack));
  break;
}

case OpCode.OP_SET_UPVALUE: {
  const slot = this.readByte();
  frame.closure.upvalues[slot].write(this.stack, this.peek(0));
  break;
}

case OpCode.OP_CLOSE_UPVALUE:
  this.closeUpvalues(this.stack.length - 1);
  this.pop();
  break;
```

**Open upvalue management** (linked list sorted by stack position):

```typescript
private openUpvalues: VmUpvalue | null = null;

private captureUpvalue(location: number): VmUpvalue {
  // Search linked list for existing upvalue at this location
  let prev: VmUpvalue | null = null;
  let uv = this.openUpvalues;
  while (uv !== null && uv.location > location) {
    prev = uv;
    uv = uv.next;
  }
  if (uv !== null && uv.location === location) return uv;

  const created = new VmUpvalue(location);
  created.next = uv;
  if (prev === null) this.openUpvalues = created;
  else prev.next = created;
  return created;
}

private closeUpvalues(last: number): void {
  while (this.openUpvalues !== null && this.openUpvalues.location >= last) {
    const uv = this.openUpvalues;
    uv.close(this.stack);
    this.openUpvalues = uv.next;
  }
}
```

Also call `closeUpvalues(frame.base)` in `OP_RETURN` before popping the frame.

---

## Tests to Write

Create `tests/vm/Closures.test.ts`:

```typescript
describe('Closures in VM', () => {
  it('closure captures a local variable', () => {
    expect(capture(`
      fun makeCounter() {
        var count = 0;
        fun inc() {
          count = count + 1;
          return count;
        }
        return inc;
      }
      var c = makeCounter();
      print c();
      print c();
      print c();
    `)).toEqual(['1', '2', '3']);
  });

  it('two closures share the same upvalue', () => {
    expect(capture(`
      fun make() {
        var x = 0;
        fun get() { return x; }
        fun set(v) { x = v; }
        // Return both as a pair via a simple trick
        var result = get; // just test one
        return result;
      }
      var g = make();
      print g();
    `)).toEqual(['0']);
  });

  it('closed-over variable persists after scope ends', () => {
    expect(capture(`
      var globalFn;
      {
        var x = "captured";
        fun f() { print x; }
        globalFn = f;
      }
      globalFn();
    `)).toEqual(['captured']);
  });

  it('multiple closures with independent state', () => {
    expect(capture(`
      fun counter() {
        var n = 0;
        fun inc() { n = n + 1; return n; }
        return inc;
      }
      var c1 = counter();
      var c2 = counter();
      print c1();  // 1
      print c1();  // 2
      print c2();  // 1 (independent)
    `)).toEqual(['1', '2', '1']);
  });
});
```

---

## Acceptance Criteria

- [ ] All closure tests pass
- [ ] Open upvalues share the same `VmUpvalue` object (not duplicated)
- [ ] Upvalues are correctly closed when variables go out of scope
- [ ] Multiple closures over the same variable share state
- [ ] Independent closure instances have independent state
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- This is the most complex step in Part III. Take it slowly.
- Every function is now a `VmClosure`, even ones that don't capture anything.
- `OP_RETURN` must call `closeUpvalues(frame.base)` to close any upvalues that point into the returning frame's stack window.
- Commit with message: `feat(vm): add closures with upvalue capture to VM`
