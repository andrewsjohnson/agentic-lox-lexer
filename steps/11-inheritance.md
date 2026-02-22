# Step 11 — Inheritance

**Book reference**: Chapter 13 — Inheritance
**Builds on**: Step 10 (classes)

---

## Overview

This step completes the tree-walk interpreter (Part II) by adding:
- **Inheritance** — a class can extend another class with `< SuperClass`
- **`super`** — subclass methods can call superclass methods via `super.method(args)`
- **Method inheritance** — subclass instances inherit all superclass methods
- **Method overriding** — subclass methods shadow superclass methods of the same name

After this step, the Lox tree-walk interpreter is feature-complete.

---

## Grammar Additions

```
classDecl → "class" IDENTIFIER ( "<" IDENTIFIER )? "{" function* "}"

primary → ... | "super" "." IDENTIFIER
```

---

## What to Implement

### Update `Stmt.Class`

```typescript
export class Class extends Stmt {
  constructor(
    public readonly name: Token,
    public readonly superclass: Expr.Variable | null,  // add this
    public readonly methods: Stmt.Function[],
  ) { ... }
}
```

### New `Expr.Super`

```typescript
export class Super extends Expr {
  constructor(
    public readonly keyword: Token,   // the 'super' token
    public readonly method: Token,    // the method name after '.'
  ) { ... }
}
```

Add `visitSuperExpr(expr: Expr.Super): R` to the visitor interface.

### Update `src/lox/LoxClass.ts`

Add a `superclass: LoxClass | null` field:

```typescript
export class LoxClass implements LoxCallable {
  constructor(
    public readonly name: string,
    public readonly superclass: LoxClass | null,
    private readonly methods: Map<string, LoxFunction>,
  ) {}

  findMethod(name: string): LoxFunction | undefined {
    if (this.methods.has(name)) return this.methods.get(name);
    if (this.superclass) return this.superclass.findMethod(name);
    return undefined;
  }
}
```

### Update `src/lox/Parser.ts`

- In `classDeclaration()`: optionally parse `< IDENTIFIER` after the class name.
  The superclass is an `Expr.Variable` (validated later in the resolver).
- In `primary()`: if current token is `super`, consume it, expect `.`, then expect
  `IDENTIFIER`, return `new Expr.Super(keyword, method)`.

### Update `src/lox/Resolver.ts`

Add `ClassType.SUBCLASS`:

```typescript
enum ClassType { NONE, CLASS, SUBCLASS }
```

**`visitClassStmt` updates:**
1. If the class has a superclass:
   - Resolve the superclass expression
   - If `stmt.superclass.name.lexeme === stmt.name.lexeme`, error: "A class can't inherit from itself."
   - Set `currentClass = ClassType.SUBCLASS`
   - Begin a new scope and define `"super"` → `true` in it
2. Begin the `"this"` scope (as before)
3. Resolve methods
4. End the `"this"` scope
5. If there was a superclass scope, end it

**`visitSuperExpr`:**
- If `currentClass === ClassType.NONE`, error: "Can't use 'super' outside of a class."
- If `currentClass !== ClassType.SUBCLASS`, error: "Can't use 'super' in a class with no superclass."
- Call `resolveLocal(expr, expr.keyword)`

### Update `src/lox/Interpreter.ts`

**`visitClassStmt` updates:**
1. Evaluate the superclass expression (if any) — verify it's a `LoxClass`, throw `RuntimeError` otherwise
2. If there is a superclass, create a new environment with `"super"` bound to the superclass
3. Build method `LoxFunction`s in that environment
4. Pass superclass to `LoxClass` constructor

**`visitSuperExpr`:**

```typescript
visitSuperExpr(expr: Expr.Super): LoxValue {
  const distance = this.locals.get(expr)!;
  const superclass = this.environment.getAt(distance, 'super') as LoxClass;
  // "this" is always one level nearer than "super"
  const object = this.environment.getAt(distance - 1, 'this') as LoxInstance;
  const method = superclass.findMethod(expr.method.lexeme);
  if (!method) {
    throw new RuntimeError(expr.method, `Undefined property '${expr.method.lexeme}'.`);
  }
  return method.bind(object);
}
```

---

## Tests to Write

Create `tests/lox/Inheritance.test.ts`:

```typescript
describe('Inheritance basics', () => {
  it('subclass inherits method from superclass', () => {
    expect(run(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {}
      Dog().speak();
    `)).toEqual(['...']);
  });

  it('subclass overrides method', () => {
    expect(run(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {
        speak() { print "Woof!"; }
      }
      Dog().speak();
    `)).toEqual(['Woof!']);
  });

  it('subclass uses its own fields and inherited methods', () => {
    expect(run(`
      class Animal {
        init(name) { this.name = name; }
        describe() { print this.name; }
      }
      class Dog < Animal {}
      var d = Dog("Rex");
      d.describe();
    `)).toEqual(['Rex']);
  });
});

describe('super', () => {
  it('calls superclass method via super', () => {
    expect(run(`
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

  it('super method is bound to current instance', () => {
    expect(run(`
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

  it('multi-level super call', () => {
    expect(run(`
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

describe('Inheritance resolver errors', () => {
  it('class cannot inherit from itself', () => {
    expect(() => run('class Foo < Foo {}')).toThrow();
  });

  it('super outside class is an error', () => {
    expect(() => run('super.method();')).toThrow();
  });

  it('super in class with no superclass is an error', () => {
    expect(() => run(`
      class Foo {
        method() { super.something(); }
      }
    `)).toThrow();
  });

  it('inheriting from a non-class is a runtime error', () => {
    expect(() => run('var x = 1; class Foo < x {}')).toThrow(RuntimeError);
  });
});

describe('Complete inheritance program', () => {
  it('runs the classic doughnut/boston creme example', () => {
    const src = `
      class Doughnut {
        cook() {
          print "Fry until golden brown.";
        }
      }

      class BostonCream < Doughnut {
        cook() {
          super.cook();
          print "Pipe full of custard and coat with chocolate.";
        }
      }

      BostonCream().cook();
    `;
    expect(run(src)).toEqual([
      'Fry until golden brown.',
      'Pipe full of custard and coat with chocolate.',
    ]);
  });
});
```

---

## Acceptance Criteria

- [ ] All inheritance tests pass
- [ ] Inherited methods use the subclass instance's `this` when called
- [ ] `super` correctly finds and binds superclass methods
- [ ] Multi-level inheritance chains work (A → B → C)
- [ ] Resolver catches: inherit from self, `super` outside class, `super` in non-subclass
- [ ] Runtime catches: inheriting from a non-class value
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The `"super"` environment is created between the `"this"` environment and the method environments, so `getAt(distance - 1, 'this')` works because `"this"` is exactly one scope inside `"super"`.
- After this step, Part II (tree-walk interpreter) is complete. You now have a fully functional Lox interpreter. Congratulations!
- Run the full test suite to confirm everything passes before moving on to Part III.
- Commit with message: `feat(lox): add inheritance and super — complete tree-walk interpreter`
