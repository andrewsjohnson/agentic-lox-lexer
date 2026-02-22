# Step 10 — Classes

**Book reference**: Chapter 12 — Classes
**Builds on**: Step 09 (resolving and binding)

---

## Overview

This step adds object-oriented programming to Lox:
- **Class declarations** with methods
- **Instance creation** via `ClassName()`
- **Property access** and **method calls** via `.`
- **The `this` keyword** inside methods
- **Constructors** via the `init()` method

---

## Grammar Additions

```
declaration → classDecl | funDecl | varDecl | statement
classDecl   → "class" IDENTIFIER "{" function* "}"

primary → ... | "this"

expression → assignment
assignment → ( call "." )? IDENTIFIER "=" assignment | ...

call → primary ( "(" arguments? ")" | "." IDENTIFIER )*
```

---

## What to Implement

### New `Stmt` node: `Stmt.Class`

```typescript
export class Class extends Stmt {
  constructor(
    public readonly name: Token,
    public readonly methods: Stmt.Function[],
  ) { ... }
}
```

### New `Expr` nodes

```typescript
export class Get extends Expr {
  constructor(
    public readonly object: Expr,
    public readonly name: Token,
  ) { ... }
}

export class Set extends Expr {
  constructor(
    public readonly object: Expr,
    public readonly name: Token,
    public readonly value: Expr,
  ) { ... }
}

export class This extends Expr {
  constructor(public readonly keyword: Token) { ... }
}
```

Add visitor methods for all three.

### `src/lox/LoxClass.ts`

```typescript
export class LoxClass implements LoxCallable {
  constructor(
    public readonly name: string,
    private readonly methods: Map<string, LoxFunction>,
  ) {}

  arity(): number {
    const init = this.methods.get('init');
    return init ? init.arity() : 0;
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const instance = new LoxInstance(this);
    const init = this.findMethod('init');
    if (init) init.bind(instance).call(interpreter, args);
    return instance;
  }

  findMethod(name: string): LoxFunction | undefined {
    return this.methods.get(name);
  }

  toString(): string {
    return this.name;
  }
}
```

Update `LoxValue`:
```typescript
export type LoxValue = null | boolean | number | string | LoxCallable | LoxInstance;
```

### `src/lox/LoxInstance.ts`

```typescript
export class LoxInstance {
  private fields = new Map<string, LoxValue>();

  constructor(private readonly klass: LoxClass) {}

  get(name: Token): LoxValue {
    if (this.fields.has(name.lexeme)) {
      return this.fields.get(name.lexeme)!;
    }
    const method = this.klass.findMethod(name.lexeme);
    if (method) return method.bind(this);
    throw new RuntimeError(name, `Undefined property '${name.lexeme}'.`);
  }

  set(name: Token, value: LoxValue): void {
    this.fields.set(name.lexeme, value);
  }

  toString(): string {
    return `${this.klass.name} instance`;
  }
}
```

### Update `src/lox/LoxFunction.ts`

Add a `bind(instance: LoxInstance)` method that creates a new closure with
`this` defined:

```typescript
bind(instance: LoxInstance): LoxFunction {
  const env = new Environment(this.closure);
  env.define('this', instance);
  return new LoxFunction(this.declaration, env, this.isInitializer);
}
```

Also add `isInitializer: boolean` to `LoxFunction`. When a function is an
initializer and a `return` with a value is executed, it's a compile-time error.
When a bare `return` is executed inside an initializer, return `this` (from the
closure at depth 0).

### Update `src/lox/Parser.ts`

- Add `classDeclaration()` method
- Update `call()` to parse `.IDENTIFIER` property access as `Expr.Get`
- Update `assignment()` to parse `expr.field = value` as `Expr.Set`
- Add `Expr.This` to `primary()`: if `this` token, return `new Expr.This(previous())`

### Update `src/lox/Resolver.ts`

Add `FunctionType.INITIALIZER` and `ClassType` enum:

```typescript
enum ClassType { NONE, CLASS }
```

- `visitClassStmt`: begin a new scope, define `"this"` → `true`, resolve all methods (passing `INITIALIZER` for `init`), end scope
- `visitThisExpr`: if `currentClass === ClassType.NONE`, error. Otherwise resolve like a local variable.
- `visitGetExpr`: resolve just the object
- `visitSetExpr`: resolve value and object

**Error**: `return` with a value inside an initializer is a compile-time error.

### Update `src/lox/Interpreter.ts`

```typescript
visitClassStmt(stmt: Stmt.Class): void {
  this.environment.define(stmt.name.lexeme, null);
  const methods = new Map<string, LoxFunction>();
  for (const method of stmt.methods) {
    const fn = new LoxFunction(method, this.environment, method.name.lexeme === 'init');
    methods.set(method.name.lexeme, fn);
  }
  const klass = new LoxClass(stmt.name.lexeme, methods);
  this.environment.assign(stmt.name, klass);
}

visitGetExpr(expr: Expr.Get): LoxValue {
  const object = this.evaluate(expr.object);
  if (object instanceof LoxInstance) return object.get(expr.name);
  throw new RuntimeError(expr.name, 'Only instances have properties.');
}

visitSetExpr(expr: Expr.Set): LoxValue {
  const object = this.evaluate(expr.object);
  if (!(object instanceof LoxInstance)) {
    throw new RuntimeError(expr.name, 'Only instances have fields.');
  }
  const value = this.evaluate(expr.value);
  object.set(expr.name, value);
  return value;
}

visitThisExpr(expr: Expr.This): LoxValue {
  return this.lookUpVariable(expr.keyword, expr);
}
```

---

## Tests to Write

Create `tests/lox/Classes.test.ts`:

```typescript
describe('Class declarations and instances', () => {
  it('creates an instance', () => {
    expect(run('class Foo {} var f = Foo(); print f;')).toEqual(['Foo instance']);
  });

  it('prints a class itself', () => {
    expect(run('class Foo {} print Foo;')).toEqual(['Foo']);
  });

  it('sets and gets a field', () => {
    expect(run('class Foo {} var f = Foo(); f.x = 42; print f.x;')).toEqual(['42']);
  });

  it('throws RuntimeError on accessing undefined property', () => {
    expect(() => run('class Foo {} var f = Foo(); print f.x;')).toThrow(RuntimeError);
  });
});

describe('Methods', () => {
  it('calls a method', () => {
    expect(run(`
      class Greeter {
        greet() {
          print "hello";
        }
      }
      Greeter().greet();
    `)).toEqual(['hello']);
  });

  it('this refers to the instance', () => {
    expect(run(`
      class Counter {
        init() { this.count = 0; }
        increment() { this.count = this.count + 1; }
        value() { return this.count; }
      }
      var c = Counter();
      c.increment();
      c.increment();
      print c.value();
    `)).toEqual(['2']);
  });
});

describe('Initializer (init)', () => {
  it('init is called on construction', () => {
    expect(run(`
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

  it('init returns the instance', () => {
    expect(run(`
      class Foo {
        init() { this.x = 1; }
      }
      print Foo().x;
    `)).toEqual(['1']);
  });
});

describe('Methods as closures', () => {
  it('method stored in variable retains this binding', () => {
    expect(run(`
      class Adder {
        init(n) { this.n = n; }
        add(x) { return this.n + x; }
      }
      var a = Adder(10);
      var addFn = a.add;
      print addFn(5);
    `)).toEqual(['15']);
  });
});

describe('Resolver errors for classes', () => {
  it('this outside class is a compile-time error', () => {
    expect(() => run('print this;')).toThrow();
  });

  it('return with value in init is a compile-time error', () => {
    expect(() => run('class Foo { init() { return 1; } }')).toThrow();
  });
});
```

---

## Acceptance Criteria

- [ ] All class tests pass
- [ ] `this` is correctly bound in methods and persists when method stored in variable
- [ ] `init` is called during construction with correct arguments
- [ ] Accessing undefined property throws `RuntimeError`
- [ ] `this` outside a class is a resolver error
- [ ] `return value` inside `init` is a resolver error
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Two-step class definition in interpreter: define name as `null`, build the class, then assign it back. This allows methods that reference the class by name.
- `isLoxCallable` check: `LoxClass` must implement `LoxCallable`, so `instanceof LoxInstance` is needed for property access, and `isLoxCallable` for call expressions.
- Commit with message: `feat(lox): add classes, instances, methods, and this`
