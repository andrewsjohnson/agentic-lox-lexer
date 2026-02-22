# Step 09 — Resolving and Binding

**Book reference**: Chapter 11 — Resolving and Binding
**Builds on**: Step 08 (functions)

---

## Overview

The current interpreter has a subtle closure bug: if a variable is used in a
closure after being reassigned in the outer scope, the closure sees the new
value — but Lox's lexical scoping rules say it should see the value from when
the closure was created.

The fix is a **resolver** — a static analysis pass that runs after parsing but
before interpretation. The resolver walks the AST once, determines exactly how
many scopes to hop up the scope chain to reach each variable's definition, and
stores this "depth" in the interpreter. The interpreter then uses this depth for
precise variable lookups.

---

## What to Implement

### `src/lox/Resolver.ts`

The resolver implements `Expr.Visitor<void>` and `StmtVisitor<void>`. It uses a
stack of `Map<string, boolean>` (scope stack) to track variables.

```typescript
type Scope = Map<string, boolean>;

export class Resolver implements Expr.Visitor<void>, StmtVisitor<void> {
  private scopes: Scope[] = [];
  private currentFunction: FunctionType = FunctionType.NONE;

  constructor(private readonly interpreter: Interpreter) {}

  resolve(statements: Stmt[]): void { ... }

  // --- Stmt visitors ---
  visitBlockStmt(stmt: Stmt.Block): void { ... }
  visitVarStmt(stmt: Stmt.Var): void { ... }
  visitFunctionStmt(stmt: Stmt.Function): void { ... }
  visitExpressionStmt(stmt: Stmt.Expression): void { ... }
  visitIfStmt(stmt: Stmt.If): void { ... }
  visitPrintStmt(stmt: Stmt.Print): void { ... }
  visitReturnStmt(stmt: Stmt.Return): void { ... }
  visitWhileStmt(stmt: Stmt.While): void { ... }

  // --- Expr visitors ---
  visitVariableExpr(expr: Expr.Variable): void { ... }
  visitAssignExpr(expr: Expr.Assign): void { ... }
  visitBinaryExpr(expr: Expr.Binary): void { ... }
  visitCallExpr(expr: Expr.Call): void { ... }
  visitGroupingExpr(expr: Expr.Grouping): void { ... }
  visitLiteralExpr(expr: Expr.Literal): void { ... }
  visitLogicalExpr(expr: Expr.Logical): void { ... }
  visitUnaryExpr(expr: Expr.Unary): void { ... }

  private beginScope(): void { this.scopes.push(new Map()); }
  private endScope(): void { this.scopes.pop(); }

  private declare(name: Token): void {
    if (this.scopes.length === 0) return;
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name.lexeme)) {
      // Error: already declared in this scope
    }
    scope.set(name.lexeme, false); // declared but not yet initialized
  }

  private define(name: Token): void {
    if (this.scopes.length === 0) return;
    this.scopes[this.scopes.length - 1].set(name.lexeme, true);
  }

  private resolveLocal(expr: Expr, name: Token): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name.lexeme)) {
        this.interpreter.resolve(expr, this.scopes.length - 1 - i);
        return;
      }
    }
    // Not found in any local scope — it's global.
  }

  private resolveFunction(fn: Stmt.Function, type: FunctionType): void {
    const enclosing = this.currentFunction;
    this.currentFunction = type;
    this.beginScope();
    for (const param of fn.params) {
      this.declare(param);
      this.define(param);
    }
    this.resolve(fn.body);
    this.endScope();
    this.currentFunction = enclosing;
  }
}

enum FunctionType { NONE, FUNCTION }
```

**Variable resolution rules:**

- `declare` marks a variable as "declared but not initialized" (`false`)
- `define` marks it as "fully initialized" (`true`)
- Reading a variable that is declared but not defined (`false` in current scope) is an error: cannot read local variable in its own initializer

**`visitVarStmt`:**
1. `declare(stmt.name)` — add to current scope as `false`
2. If initializer exists, resolve it
3. `define(stmt.name)` — set to `true`

**`visitVariableExpr`:**
1. If current scope has `name.lexeme` mapped to `false`: error (reading own initializer)
2. Call `resolveLocal(expr, name)`

**`visitBlockStmt`:** begin scope, resolve statements, end scope.

**`visitFunctionStmt`:** declare + define the function name in current scope, then `resolveFunction`.

**Return validation:** if `this.currentFunction === FunctionType.NONE`, a `return` statement is an error ("Can't return from top-level code.").

### Update `src/lox/Interpreter.ts`

Add a `Map<Expr, number>` to store resolved depths:

```typescript
private locals = new Map<Expr, number>();

resolve(expr: Expr, depth: number): void {
  this.locals.set(expr, depth);
}
```

Update `visitVariableExpr` and `visitAssignExpr` to use `lookUpVariable`:

```typescript
private lookUpVariable(name: Token, expr: Expr): LoxValue {
  const distance = this.locals.get(expr);
  if (distance !== undefined) {
    return this.environment.getAt(distance, name.lexeme);
  }
  return this.globals.get(name);
}
```

Add `getAt` and `assignAt` to `Environment`:

```typescript
getAt(distance: number, name: string): LoxValue {
  return this.ancestor(distance).values.get(name) ?? null;
}

assignAt(distance: number, name: Token, value: LoxValue): void {
  this.ancestor(distance).values.set(name.lexeme, value);
}

private ancestor(distance: number): Environment {
  let env: Environment = this;
  for (let i = 0; i < distance; i++) env = env.enclosing!;
  return env;
}
```

### Update `src/lox/Lox.ts`

Add the resolver pass between parsing and interpretation:

```typescript
const resolver = new Resolver(interpreter);
resolver.resolve(statements);
if (hadError) return; // static errors from resolver
interpreter.interpret(statements);
```

---

## Tests to Write

Create `tests/lox/Resolver.test.ts`:

```typescript
describe('Resolver — basic resolution', () => {
  it('resolves a simple variable correctly', () => {
    expect(run('var x = 1; print x;')).toEqual(['1']);
  });

  it('resolves a nested scope variable', () => {
    expect(run('var x = 1; { var x = 2; print x; } print x;')).toEqual(['2', '1']);
  });
});

describe('Resolver — closure semantics', () => {
  it('closure captures variable correctly after reassignment', () => {
    // Classic closure test: the closure should see the value
    // at the time of closure creation, not at call time.
    const src = `
      var a = "global";
      {
        fun showA() {
          print a;
        }
        showA();
        var a = "block";
        showA();
      }
    `;
    // Both calls should print "global" — showA captures the global 'a'
    expect(run(src)).toEqual(['global', 'global']);
  });
});

describe('Resolver — error detection', () => {
  it('reports error for variable read in its own initializer', () => {
    // var a = a; — reading 'a' before it's initialized
    expect(() => run('var a = a;')).toThrow();
  });

  it('reports error for return at top level', () => {
    expect(() => run('return 1;')).toThrow();
  });

  it('reports error for duplicate variable in same scope', () => {
    expect(() => run('{ var a = 1; var a = 2; }')).toThrow();
  });
});
```

---

## Acceptance Criteria

- [ ] All resolver tests pass
- [ ] The closure capture test produces `['global', 'global']` (not `['global', 'block']`)
- [ ] Top-level `return` is a compile-time error
- [ ] Duplicate variable in same local scope is an error
- [ ] Reading a variable in its own initializer is an error
- [ ] All previous tests still pass
- [ ] No TypeScript errors

---

## Notes

- The resolver only traverses local scopes (the scope stack). Global variables are not tracked in the stack — they remain dynamically resolved at runtime by consulting `this.globals`.
- The resolver reports errors by calling a shared error reporting mechanism (e.g., `Lox.error(token, message)`). It does not throw — it records errors and continues to find as many errors as possible in one pass.
- `getAt` uses `values` field of `Environment` — make `values` package-accessible (remove `private`, use `readonly Map`).
- Commit with message: `feat(lox): add variable resolver for lexical scoping`
