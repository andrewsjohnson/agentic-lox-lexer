# Step 26 — Methods and Initializers (VM)

**Book reference**: Chapter 28 — Methods and Initializers
**Builds on**: Step 25 (classes)

---

## Overview

This step completes method support in the VM by adding:
- **Method lookup** — `OP_GET_PROPERTY` finding methods on classes (not just fields)
- **Bound methods** — capturing `this` when a method is accessed as a value
- **`OP_INVOKE`** — a fast path that combines `OP_GET_PROPERTY` + `OP_CALL` for method calls
- **Initializer semantics** — `init()` always returns `this`

---

## New Opcodes

```
OP_INVOKE    <method_name_constant> <arg_count>
```

`OP_INVOKE` is an optimization: instead of creating a bound method and then
calling it (two operations), it looks up the method and calls it in one step.

---

## What to Implement

### Update `src/vm/VM.ts` — `OP_GET_PROPERTY`

Add method binding when the field is not found in the instance's fields:

```typescript
case OpCode.OP_GET_PROPERTY: {
  if (!(this.peek(0) instanceof LoxVmInstance)) {
    return this.runtimeError('Only instances have properties.');
  }
  const instance = this.peek(0) as LoxVmInstance;
  const name = this.readConstant() as string;

  // Check fields first
  const fieldValue = instance.fields.get(name);
  if (fieldValue !== undefined) {
    this.pop();
    this.push(fieldValue);
    break;
  }

  // Then check methods
  if (!this.bindMethod(instance.klass, name)) {
    return InterpretResult.RUNTIME_ERROR;
  }
  break;
}
```

```typescript
private bindMethod(klass: LoxVmClass, name: string): boolean {
  const method = klass.methods.get(name);
  if (method === undefined) {
    this.runtimeError(`Undefined property '${name}'.`);
    return false;
  }
  const bound = this.gc.alloc(new VmBoundMethod(
    this.peek(0) as LoxVmInstance,
    method as VmClosure,
  ));
  this.pop(); // instance
  this.push(bound);
  return true;
}
```

### Update `callValue()` — `VmBoundMethod`

```typescript
if (callee instanceof VmBoundMethod) {
  this.stack[this.stack.length - 1 - argCount] = callee.receiver;
  return this.call(callee.method, argCount);
}
```

### `OP_INVOKE` — optimized method call

```typescript
case OpCode.OP_INVOKE: {
  const method = this.readConstant() as string;
  const argCount = this.readByte();
  if (!this.invoke(method, argCount)) return InterpretResult.RUNTIME_ERROR;
  break;
}
```

```typescript
private invoke(name: string, argCount: number): boolean {
  const receiver = this.peek(argCount);
  if (!(receiver instanceof LoxVmInstance)) {
    this.runtimeError('Only instances have methods.');
    return false;
  }

  // Check fields first (a field might shadow a method)
  const field = receiver.fields.get(name);
  if (field !== undefined) {
    this.stack[this.stack.length - 1 - argCount] = field;
    return this.callValue(field, argCount);
  }

  return this.invokeFromClass(receiver.klass, name, argCount);
}

private invokeFromClass(klass: LoxVmClass, name: string, argCount: number): boolean {
  const method = klass.methods.get(name);
  if (method === undefined) {
    this.runtimeError(`Undefined property '${name}'.`);
    return false;
  }
  return this.call(method as VmClosure, argCount);
}
```

### Update `src/vm/Compiler.ts` — emit `OP_INVOKE`

Change the `call()` infix parse function to check if the callee is a property
access, and if so, emit `OP_INVOKE` instead of `OP_GET_PROPERTY` + `OP_CALL`:

This is done by intercepting `.method()` calls in the parse rule for `(`:

Actually, the book emits `OP_INVOKE` specifically for the pattern `expr.method(args)`.
Update the `call()` parse function to look at the previous expression:

```typescript
private call(canAssign: boolean): void {
  // If previous was a property access, can use OP_INVOKE directly
  // For simplicity, always use OP_CALL — OP_INVOKE is an optimization
  // In the full implementation, detect the pattern here.
  const argCount = this.argumentList();
  this.emitBytes(OpCode.OP_CALL, argCount);
}
```

For the optimization, change `namedVariable()` for property access and wrap
the entire `.method(args)` pattern. This is architecturally complex; see the
book for full details. **A correct but un-optimized version (using OP_GET_PROPERTY + OP_CALL) is acceptable for this step's tests to pass.**

### Initializer return semantics

When a method is compiled as `FunctionType.INITIALIZER`:

1. A bare `return;` inside `init` should return `this` (not `nil`):

```typescript
private emitReturn(): void {
  if (this.currentCompiler.type === FunctionType.INITIALIZER) {
    this.emitBytes(OpCode.OP_GET_LOCAL, 0); // slot 0 = 'this'
  } else {
    this.emitByte(OpCode.OP_NIL);
  }
  this.emitByte(OpCode.OP_RETURN);
}
```

2. A `return value;` inside `init` is a compile error.

### GC — blacken VmBoundMethod

Update `GarbageCollector.blackenObject()` to handle `VmBoundMethod`:

```typescript
if (obj instanceof VmBoundMethod) {
  this.markObject(obj.receiver);
  this.markObject(obj.method);
}
```

---

## Tests to Write

Create `tests/vm/Methods.test.ts`:

```typescript
describe('Method calls', () => {
  it('calls a method on an instance', () => {
    expect(capture(`
      class Greeter {
        greet() { print "hello"; }
      }
      Greeter().greet();
    `)).toEqual(['hello']);
  });

  it('method accesses this', () => {
    expect(capture(`
      class Person {
        init(name) { this.name = name; }
        say() { print this.name; }
      }
      Person("Alice").say();
    `)).toEqual(['Alice']);
  });
});

describe('Bound methods', () => {
  it('method stored in variable retains binding', () => {
    expect(capture(`
      class Adder {
        init(n) { this.n = n; }
        add(x) { return this.n + x; }
      }
      var a = Adder(10);
      var f = a.add;
      print f(5);
    `)).toEqual(['15']);
  });
});

describe('Initializer return', () => {
  it('init returns the instance', () => {
    expect(capture(`
      class Foo {
        init() { this.x = 42; }
      }
      var f = Foo();
      print f.x;
    `)).toEqual(['42']);
  });

  it('bare return in init still returns instance', () => {
    expect(capture(`
      class Foo {
        init() {
          this.x = 1;
          return;
          this.x = 99; // never reached
        }
      }
      print Foo().x;
    `)).toEqual(['1']);
  });

  it('return with value in init is a compile error', () => {
    expect(run(`
      class Foo {
        init() { return 42; }
      }
    `)).toBe(InterpretResult.COMPILE_ERROR);
  });
});

describe('Field shadows method', () => {
  it('field takes priority over same-named method', () => {
    expect(capture(`
      class Foo {
        init() { this.bar = "field"; }
        bar() { print "method"; }
      }
      print Foo().bar;
    `)).toEqual(['field']);
  });
});
```

---

## Acceptance Criteria

- [ ] All method tests pass
- [ ] Bound methods correctly capture `this`
- [ ] `init` always returns the instance
- [ ] `return value` in `init` is a compile error
- [ ] Fields shadow methods of the same name
- [ ] `VmBoundMethod` is GC-tracked
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The `OP_INVOKE` optimization is optional for correctness — the tests will pass with `OP_GET_PROPERTY` + `OP_CALL`. Implement `OP_INVOKE` if you want the performance benefit.
- When the VM calls a method (via `OP_CALL` on a `VmBoundMethod`), it places the bound receiver at the base slot (slot 0) of the new frame — this is how `this` becomes accessible in the method.
- Commit with message: `feat(vm): add method binding, bound methods, and initializer semantics`
