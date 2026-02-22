# Step 27 — Superclasses (VM)

**Book reference**: Chapter 29 — Superclasses
**Builds on**: Step 26 (methods and initializers)

---

## Overview

This step adds **inheritance** to the bytecode VM, completing the VM
implementation of Lox. After this step, the VM is feature-complete.

---

## New Opcodes

```
OP_INHERIT              // copy superclass methods to subclass
OP_GET_SUPER            // look up a method on the superclass
OP_SUPER_INVOKE         // fast path: invoke a super method directly
```

---

## Grammar

```
classDecl → "class" IDENTIFIER ( "<" IDENTIFIER )? "{" function* "}"
primary   → ... | "super" "." IDENTIFIER
```

---

## What to Implement

### Update `src/vm/Compiler.ts`

**Class declaration with superclass:**

```typescript
private classDeclaration(): void {
  this.consume(TokenType.IDENTIFIER, 'Expect class name.');
  const className = this.previous;
  const nameConstant = this.identifierConstant(className);
  this.declareVariable();

  this.emitBytes(OpCode.OP_CLASS, nameConstant);
  this.defineVariable(nameConstant);

  const classContext: ClassContext = { name: className, hasSuperclass: false };
  this.classStack.push(classContext);

  if (this.match(TokenType.LESS)) {
    this.consume(TokenType.IDENTIFIER, 'Expect superclass name.');
    this.variable(false); // push superclass onto stack

    if (getLexeme(this.source, className) === getLexeme(this.source, this.previous)) {
      this.error("A class can't inherit from itself.");
    }

    // Create a new scope with 'super' defined
    this.beginScope();
    this.addLocal(this.syntheticToken('super'));
    this.defineVariable(0);

    this.namedVariable(className, false); // push subclass
    this.emitByte(OpCode.OP_INHERIT);

    classContext.hasSuperclass = true;
  }

  this.namedVariable(className, false); // push class for method definitions

  this.consume(TokenType.LEFT_BRACE, "Expect '{' before class body.");
  while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
    this.method();
  }
  this.consume(TokenType.RIGHT_BRACE, "Expect '}' after class body.");
  this.emitByte(OpCode.OP_POP); // pop the class

  if (classContext.hasSuperclass) this.endScope();
  this.classStack.pop();
}
```

**`super` expression:**

```typescript
private super_(canAssign: boolean): void {
  if (this.classStack.length === 0) {
    this.error("Can't use 'super' outside of a class.");
  } else if (!this.classStack[this.classStack.length - 1].hasSuperclass) {
    this.error("Can't use 'super' in a class with no superclass.");
  }

  this.consume(TokenType.DOT, "Expect '.' after 'super'.");
  this.consume(TokenType.IDENTIFIER, 'Expect superclass method name.');
  const name = this.identifierConstant(this.previous);

  // Load 'this' and 'super'
  this.namedVariable(this.syntheticToken('this'), false);

  if (this.match(TokenType.LEFT_PAREN)) {
    // super.method(args) — emit OP_SUPER_INVOKE
    const argCount = this.argumentList();
    this.namedVariable(this.syntheticToken('super'), false);
    this.emitBytes(OpCode.OP_SUPER_INVOKE, name);
    this.emitByte(argCount);
  } else {
    // super.method (without call) — emit OP_GET_SUPER
    this.namedVariable(this.syntheticToken('super'), false);
    this.emitBytes(OpCode.OP_GET_SUPER, name);
  }
}

private syntheticToken(text: string): AnyVmToken {
  // Create a fake token for 'this' and 'super'
  const start = this.source.indexOf(text);
  return { type: TokenType.IDENTIFIER, start: start >= 0 ? start : 0, length: text.length, line: 0 };
}
```

Register `super_` in parse rules for `TokenType.SUPER`.

### Update `src/vm/VM.ts`

```typescript
case OpCode.OP_INHERIT: {
  const superclass = this.peek(1);
  const subclass   = this.peek(0);
  if (!(superclass instanceof LoxVmClass)) {
    return this.runtimeError('Superclass must be a class.');
  }
  // Copy all methods from superclass to subclass
  (subclass as LoxVmClass).methods.addAll((superclass as LoxVmClass).methods);
  this.pop(); // subclass
  break;
}

case OpCode.OP_GET_SUPER: {
  const name       = this.readConstant() as string;
  const superclass = this.pop() as LoxVmClass;
  if (!this.bindMethod(superclass, name)) return InterpretResult.RUNTIME_ERROR;
  break;
}

case OpCode.OP_SUPER_INVOKE: {
  const method   = this.readConstant() as string;
  const argCount = this.readByte();
  const superclass = this.pop() as LoxVmClass;
  if (!this.invokeFromClass(superclass, method, argCount)) {
    return InterpretResult.RUNTIME_ERROR;
  }
  break;
}
```

### Update `LoxVmClass` — `addAll`

Make sure `LoxVmClass.methods` (a `Table`) has `addAll`:
```typescript
methods.addAll(superclass.methods); // already supported by Table
```

### GC — blacken `LoxVmClass`

```typescript
if (obj instanceof LoxVmClass) {
  for (const methodVal of /* iterate methods table values */) {
    this.markObject(methodVal as GcObject);
  }
}
```

Add an iteration method to `Table`:
```typescript
*values(): Iterable<VmValue> {
  for (const entry of this.entries) {
    if (entry && entry.key !== null) yield entry.value;
  }
}
```

---

## Tests to Write

Create `tests/vm/Superclasses.test.ts`:

```typescript
describe('Inheritance basics in VM', () => {
  it('subclass inherits method from superclass', () => {
    expect(capture(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {}
      Dog().speak();
    `)).toEqual(['...']);
  });

  it('subclass overrides method', () => {
    expect(capture(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {
        speak() { print "Woof!"; }
      }
      Dog().speak();
    `)).toEqual(['Woof!']);
  });

  it('inherits init from superclass', () => {
    expect(capture(`
      class Animal {
        init(name) { this.name = name; }
      }
      class Dog < Animal {}
      print Dog("Rex").name;
    `)).toEqual(['Rex']);
  });
});

describe('super in VM', () => {
  it('calls superclass method via super', () => {
    expect(capture(`
      class A {
        method() { print "A"; }
      }
      class B < A {
        method() {
          super.method();
          print "B";
        }
      }
      B().method();
    `)).toEqual(['A', 'B']);
  });

  it('super method bound to current instance', () => {
    expect(capture(`
      class Base {
        whoAmI() { print this.name; }
      }
      class Child < Base {
        init(name) { this.name = name; }
        greet() { super.whoAmI(); }
      }
      Child("Charlie").greet();
    `)).toEqual(['Charlie']);
  });

  it('multi-level super (A -> B -> C)', () => {
    expect(capture(`
      class A {
        method() { print "A"; }
      }
      class B < A {
        method() { super.method(); print "B"; }
      }
      class C < B {
        method() { super.method(); print "C"; }
      }
      C().method();
    `)).toEqual(['A', 'B', 'C']);
  });
});

describe('Superclass errors', () => {
  it('class cannot inherit from itself', () => {
    expect(run('class Foo < Foo {}')).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('super outside class is a compile error', () => {
    expect(run('super.method();')).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('super in class with no superclass is a compile error', () => {
    expect(run(`class Foo { m() { super.x(); } }`)).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('inheriting from non-class is a runtime error', () => {
    expect(run('var x = 1; class Foo < x {}')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('Complete program', () => {
  it('runs the doughnut/boston cream example', () => {
    expect(capture(`
      class Doughnut {
        cook() { print "Fry until golden brown."; }
      }
      class BostonCream < Doughnut {
        cook() {
          super.cook();
          print "Pipe full of custard and coat with chocolate.";
        }
      }
      BostonCream().cook();
    `)).toEqual([
      'Fry until golden brown.',
      'Pipe full of custard and coat with chocolate.',
    ]);
  });
});
```

---

## Acceptance Criteria

- [ ] All superclass tests pass
- [ ] `OP_INHERIT` copies all superclass methods to the subclass at class creation time
- [ ] `super.method()` calls the correct superclass method bound to `this`
- [ ] Multi-level inheritance works
- [ ] Compile errors: inherit from self, `super` outside class, `super` without superclass
- [ ] Runtime error: inherit from non-class
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- `OP_INHERIT` copies methods at **class definition time** (not at call time) — this means all instances of the subclass share the inherited methods in the class's method table.
- `super` is implemented as a local variable (an upvalue captured from the surrounding scope) — this is the same approach as in Part II.
- After this step, the VM (Part III) is complete. Run the full test suite (`npm test`) and verify everything passes.
- Commit with message: `feat(vm): add inheritance and super — complete bytecode VM`
