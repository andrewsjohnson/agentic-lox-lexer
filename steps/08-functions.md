# Step 08 — Functions

**Book reference**: Chapter 10 — Functions
**Builds on**: Step 07 (control flow)

---

## Overview

This step adds first-class functions to the Lox interpreter:
- `fun` declarations
- Function call expressions (with arguments)
- `return` statements
- A `clock()` native function (for benchmarking)
- Closures (functions that capture their defining environment)

---

## Grammar Additions

```
declaration → funDecl | varDecl | statement
funDecl     → "fun" function
function    → IDENTIFIER "(" parameters? ")" block
parameters  → IDENTIFIER ( "," IDENTIFIER )*

statement → ... | returnStmt
returnStmt → "return" expression? ";"

primary    → ... | IDENTIFIER "(" arguments? ")"
call       → primary ( "(" arguments? ")" )*
arguments  → expression ( "," expression )*
```

---

## What to Implement

### New `Stmt` nodes in `src/lox/Stmt.ts`

```typescript
export class Function extends Stmt {
  constructor(
    public readonly name: Token,
    public readonly params: Token[],
    public readonly body: Stmt[],
  ) { ... }
}

export class Return extends Stmt {
  constructor(
    public readonly keyword: Token,  // for error reporting
    public readonly value: Expr | null,
  ) { ... }
}
```

### New `Expr` node: `Expr.Call`

```typescript
export class Call extends Expr {
  constructor(
    public readonly callee: Expr,
    public readonly paren: Token,   // closing paren, for error reporting
    public readonly args: Expr[],
  ) { ... }
}
```

Add `visitCallExpr(expr: Expr.Call): R` to the visitor interface.

### `src/lox/LoxCallable.ts`

```typescript
import type { Interpreter } from './Interpreter';
import type { LoxValue } from './Interpreter';

export interface LoxCallable {
  arity(): number;
  call(interpreter: Interpreter, args: LoxValue[]): LoxValue;
  toString(): string;
}

export function isLoxCallable(value: unknown): value is LoxCallable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LoxCallable).call === 'function' &&
    typeof (value as LoxCallable).arity === 'function'
  );
}
```

Update `LoxValue`:
```typescript
export type LoxValue = null | boolean | number | string | LoxCallable;
```

### `src/lox/LoxFunction.ts`

```typescript
export class LoxFunction implements LoxCallable {
  constructor(
    private readonly declaration: Stmt.Function,
    private readonly closure: Environment,
  ) {}

  arity(): number {
    return this.declaration.params.length;
  }

  call(interpreter: Interpreter, args: LoxValue[]): LoxValue {
    const env = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      env.define(this.declaration.params[i].lexeme, args[i]);
    }
    try {
      interpreter.executeBlock(this.declaration.body, env);
    } catch (err) {
      if (err instanceof Return) return err.value;
      throw err;
    }
    return null;
  }

  toString(): string {
    return `<fn ${this.declaration.name.lexeme}>`;
  }
}
```

### Return exception in `src/lox/Return.ts`

Use an exception (not a `RuntimeError`) to unwind the call stack on `return`:

```typescript
import type { LoxValue } from './Interpreter';

export class Return extends Error {
  constructor(public readonly value: LoxValue) {
    super();
  }
}
```

(Note: this `Return` class is separate from `Stmt.Return`.)

### Update `src/lox/Parser.ts`

- Add `funDeclaration('function')` method
- Add `returnStatement()` method
- Update `primary()` to not handle calls — instead add:
- `call()` method that wraps `primary()` in zero or more `(args)` call suffixes
- Update the grammar chain: `unary()` → ... `call()` → `primary()`

### Update `src/lox/Interpreter.ts`

```typescript
visitFunctionStmt(stmt: Stmt.Function): void {
  const fn = new LoxFunction(stmt, this.environment);
  this.environment.define(stmt.name.lexeme, fn);
}

visitReturnStmt(stmt: Stmt.Return): void {
  const value = stmt.value ? this.evaluate(stmt.value) : null;
  throw new Return(value);
}

visitCallExpr(expr: Expr.Call): LoxValue {
  const callee = this.evaluate(expr.callee);
  const args = expr.args.map(a => this.evaluate(a));

  if (!isLoxCallable(callee)) {
    throw new RuntimeError(expr.paren, 'Can only call functions and classes.');
  }
  if (args.length !== callee.arity()) {
    throw new RuntimeError(expr.paren,
      `Expected ${callee.arity()} arguments but got ${args.length}.`);
  }
  return callee.call(this, args);
}
```

Add the native `clock` function in the interpreter's constructor:
```typescript
this.globals.define('clock', {
  arity: () => 0,
  call: () => Date.now() / 1000,
  toString: () => '<native fn>',
} satisfies LoxCallable);
```

Make `executeBlock` public so `LoxFunction` can call it.

---

## Tests to Write

Create `tests/lox/Functions.test.ts`:

```typescript
describe('Function declarations', () => {
  it('declares and calls a simple function', () => {
    expect(run('fun greet() { print "hi"; } greet();')).toEqual(['hi']);
  });

  it('function with parameters', () => {
    expect(run('fun add(a, b) { print a + b; } add(1, 2);')).toEqual(['3']);
  });

  it('function with return value', () => {
    expect(run('fun double(x) { return x * 2; } print double(5);')).toEqual(['10']);
  });

  it('return nil when no return statement', () => {
    expect(run('fun noop() {} print noop();')).toEqual(['nil']);
  });

  it('bare return returns nil', () => {
    expect(run('fun early() { return; } print early();')).toEqual(['nil']);
  });
});

describe('Recursion', () => {
  it('computes factorial recursively', () => {
    const src = `
      fun fib(n) {
        if (n <= 1) return n;
        return fib(n - 2) + fib(n - 1);
      }
      print fib(8);
    `;
    expect(run(src)).toEqual(['21']);
  });
});

describe('Closures', () => {
  it('function captures its defining environment', () => {
    const src = `
      fun makeCounter() {
        var count = 0;
        fun increment() {
          count = count + 1;
          return count;
        }
        return increment;
      }
      var counter = makeCounter();
      print counter();
      print counter();
      print counter();
    `;
    expect(run(src)).toEqual(['1', '2', '3']);
  });
});

describe('Native functions', () => {
  it('clock() returns a number', () => {
    const output = run('print clock();');
    expect(output.length).toBe(1);
    expect(Number(output[0])).toBeGreaterThan(0);
  });
});

describe('Call errors', () => {
  it('throws RuntimeError when calling a non-callable', () => {
    expect(() => run('var x = 1; x();')).toThrow(RuntimeError);
  });

  it('throws RuntimeError on argument count mismatch', () => {
    expect(() => run('fun f(a) {} f(1, 2);')).toThrow(RuntimeError);
  });
});

describe('Function toString', () => {
  it('prints function as <fn name>', () => {
    expect(run('fun foo() {} print foo;')).toEqual(['<fn foo>']);
  });
});
```

---

## Acceptance Criteria

- [ ] All function tests pass
- [ ] Closures correctly capture the defining environment (counter increments)
- [ ] Recursion works (fibonacci, factorial)
- [ ] `return` unwinds the call stack via exception mechanism
- [ ] Arity mismatch throws `RuntimeError`
- [ ] `clock()` native function works
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- `LoxFunction.call()` creates a **new environment** with `closure` as parent — this captures variables from the enclosing scope at the time the function was defined, not when it's called.
- Make `globals` a separate `Environment` field in `Interpreter` so native functions aren't affected by block scopes. `this.environment` starts as `this.globals`.
- The `Return` exception class must **not** extend `RuntimeError` — it's a control-flow mechanism, not an error.
- Functions are values in Lox — they can be assigned to variables and passed as arguments.
- Commit with message: `feat(lox): add functions, closures, and return statements`
