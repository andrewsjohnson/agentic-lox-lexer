# Step 25 — Classes and Instances (VM)

**Book reference**: Chapter 27 — Classes and Instances
**Builds on**: Step 24 (garbage collection)

---

## Overview

This step adds **classes** and **instances** to the bytecode VM. Unlike the
tree-walk interpreter (where classes are runtime objects), in the VM they are
represented as first-class values compiled and executed as bytecode.

---

## New Opcodes

```
OP_CLASS          <name_constant>   // create a class
OP_GET_PROPERTY   <name_constant>   // get instance field/method
OP_SET_PROPERTY   <name_constant>   // set instance field
OP_METHOD         <name_constant>   // define a method on the class on stack
```

---

## What to Implement

### `src/vm/VmClass.ts`

```typescript
import { Table } from './Table';
import type { VmClosure } from './VmFunction';

export class LoxVmClass {
  readonly methods: Table = new Table();
  _gcMark: 'white' | 'grey' | 'black' = 'white';

  constructor(public readonly name: string) {}

  toString(): string { return this.name; }
}

export class LoxVmInstance {
  readonly fields: Table = new Table();
  _gcMark: 'white' | 'grey' | 'black' = 'white';

  constructor(public readonly klass: LoxVmClass) {}

  toString(): string { return `${this.klass.name} instance`; }
}
```

Update `VmValue` to include these:
```typescript
export type VmValue = null | boolean | number | string
  | VmFunction | VmClosure | VmNative | VmUpvalue
  | LoxVmClass | LoxVmInstance | VmBoundMethod;
```

### `src/vm/VmBoundMethod.ts`

```typescript
import type { VmClosure } from './VmFunction';
import type { LoxVmInstance } from './VmClass';

export class VmBoundMethod {
  _gcMark: 'white' | 'grey' | 'black' = 'white';

  constructor(
    public readonly receiver: LoxVmInstance,
    public readonly method: VmClosure,
  ) {}

  toString(): string { return this.method.fn.toString(); }
}
```

(Bound methods are used in Step 26.)

### Update `src/vm/Compiler.ts`

**Class declaration:**

```typescript
private classDeclaration(): void {
  this.consume(TokenType.IDENTIFIER, 'Expect class name.');
  const className = this.previous;
  const nameConstant = this.identifierConstant(className);
  this.declareVariable();

  this.emitBytes(OpCode.OP_CLASS, nameConstant);
  this.defineVariable(nameConstant);

  // Push class context
  this.classStack.push({ name: className, hasSuperclass: false });

  this.consume(TokenType.LEFT_BRACE, "Expect '{' before class body.");
  while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
    this.method();
  }
  this.consume(TokenType.RIGHT_BRACE, "Expect '}' after class body.");
  this.emitByte(OpCode.OP_POP); // pop the class

  this.classStack.pop();
}

private method(): void {
  this.consume(TokenType.IDENTIFIER, 'Expect method name.');
  const constant = this.identifierConstant(this.previous);
  const type = getLexeme(this.source, this.previous) === 'init'
    ? FunctionType.INITIALIZER
    : FunctionType.METHOD;
  this.function(type);
  this.emitBytes(OpCode.OP_METHOD, constant);
}
```

Add `classStack` for tracking current class context (used for `this` in Step 26).

**`this` keyword:**

```typescript
private thisKeyword(canAssign: boolean): void {
  if (this.classStack.length === 0) {
    this.error("Can't use 'this' outside of a class.");
    return;
  }
  this.variable(false); // 'this' is a local at slot 0
}
```

Register `this` in parse rules.

**In `function()` for methods:** when type is `METHOD` or `INITIALIZER`, add
`"this"` as the first local (slot 0 of the call frame):

```typescript
// At the start of compiling a method:
if (type !== FunctionType.FUNCTION && type !== FunctionType.SCRIPT) {
  // Slot 0 is implicitly "this"
  this.currentCompiler.locals[0] = {
    name: syntheticToken('this'),
    depth: 0,
    isCaptured: false,
  };
}
```

### Update `src/vm/VM.ts`

```typescript
case OpCode.OP_CLASS: {
  const name = this.readConstant() as string;
  this.push(this.gc.alloc(new LoxVmClass(name)));
  break;
}

case OpCode.OP_GET_PROPERTY: {
  if (!(this.peek(0) instanceof LoxVmInstance)) {
    return this.runtimeError('Only instances have properties.');
  }
  const instance = this.peek(0) as LoxVmInstance;
  const name = this.readConstant() as string;

  const fieldValue = instance.fields.get(name);
  if (fieldValue !== undefined) {
    this.pop(); // instance
    this.push(fieldValue);
    break;
  }

  // Try method (will be added in Step 26)
  return this.runtimeError(`Undefined property '${name}'.`);
}

case OpCode.OP_SET_PROPERTY: {
  if (!(this.peek(1) instanceof LoxVmInstance)) {
    return this.runtimeError('Only instances have fields.');
  }
  const instance = this.peek(1) as LoxVmInstance;
  const name = this.readConstant() as string;
  instance.fields.set(name, this.peek(0));
  const value = this.pop();
  this.pop(); // instance
  this.push(value);
  break;
}

case OpCode.OP_METHOD: {
  const name = this.readConstant() as string;
  const method = this.peek(0) as VmClosure;
  const klass  = this.peek(1) as LoxVmClass;
  klass.methods.set(name, method);
  this.pop();
  break;
}
```

**Update `callValue()`** to handle `LoxVmClass`:

```typescript
if (callee instanceof LoxVmClass) {
  const instance = this.gc.alloc(new LoxVmInstance(callee));
  this.stack[this.stack.length - 1 - argCount] = instance;
  // Call init if it exists
  const init = callee.methods.get('init');
  if (init) {
    return this.call(init as VmClosure, argCount);
  } else if (argCount !== 0) {
    this.runtimeError(`Expected 0 arguments but got ${argCount}.`);
    return false;
  }
  return true;
}
```

---

## Tests to Write

Create `tests/vm/Classes.test.ts`:

```typescript
describe('Class creation', () => {
  it('creates an instance', () => {
    expect(capture('class Foo {} print Foo();')).toEqual(['Foo instance']);
  });

  it('prints class itself', () => {
    expect(capture('class Foo {} print Foo;')).toEqual(['Foo']);
  });
});

describe('Fields', () => {
  it('sets and gets a field', () => {
    expect(capture('class Foo {} var f = Foo(); f.x = 42; print f.x;')).toEqual(['42']);
  });

  it('runtime error on accessing undefined property', () => {
    expect(run('class Foo {} var f = Foo(); print f.x;')).toBe(InterpretResult.RUNTIME_ERROR);
  });

  it('runtime error getting property of non-instance', () => {
    expect(run('var x = 1; print x.y;')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('init method', () => {
  it('init is called on construction', () => {
    expect(capture(`
      class Point {
        init(x, y) {
          this.x = x;
          this.y = y;
        }
      }
      var p = Point(3, 4);
      print p.x;
      print p.y;
    `)).toEqual(['3', '4']);
  });
});

describe('this in methods', () => {
  it('this refers to instance in method', () => {
    expect(capture(`
      class Counter {
        init() { this.n = 0; }
        inc() { this.n = this.n + 1; }
        val() { return this.n; }
      }
      var c = Counter();
      c.inc();
      c.inc();
      print c.val();
    `)).toEqual(['2']);
  });
});

describe('Compiler errors', () => {
  it('this outside class is a compile error', () => {
    expect(run('print this;')).toBe(InterpretResult.COMPILE_ERROR);
  });
});
```

---

## Acceptance Criteria

- [ ] All class tests pass
- [ ] `LoxVmClass` and `LoxVmInstance` are GC-tracked
- [ ] `OP_CLASS`, `OP_GET_PROPERTY`, `OP_SET_PROPERTY`, `OP_METHOD` implemented
- [ ] `init` is called during construction
- [ ] `this` correctly refers to the instance
- [ ] `this` outside a class is a compile error
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The class itself stays on the stack while methods are being defined — `OP_METHOD` peeks at `stack[top-1]` to find the class.
- After all methods are defined, the class is consumed by `OP_POP` (the class was assigned to a variable earlier via `OP_DEFINE_GLOBAL`/`OP_SET_LOCAL`).
- Commit with message: `feat(vm): add classes and instances to VM`
