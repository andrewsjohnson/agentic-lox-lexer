# Step 07 — Control Flow

**Book reference**: Chapter 9 — Control Flow
**Builds on**: Step 06 (statements and state)

---

## Overview

This step adds branching and looping to the interpreter:
- **`if`/`else`** statements
- **`while`** loops
- **`for`** loops (desugared into `while`)
- **`and`** and **`or`** logical operators (with short-circuit evaluation)

---

## Grammar Additions

```
statement → exprStmt | forStmt | ifStmt | printStmt | whileStmt | block

ifStmt    → "if" "(" expression ")" statement ( "else" statement )?
whileStmt → "while" "(" expression ")" statement
forStmt   → "for" "(" ( varDecl | exprStmt | ";" )
                      expression? ";"
                      expression? ")" statement

expression → assignment
assignment → IDENTIFIER "=" assignment | logic_or
logic_or   → logic_and ( "or" logic_and )*
logic_and  → equality ( "and" equality )*
```

---

## What to Implement

### New `Stmt` nodes in `src/lox/Stmt.ts`

```typescript
export class If extends Stmt {
  constructor(
    public readonly condition: Expr,
    public readonly thenBranch: Stmt,
    public readonly elseBranch: Stmt | null,
  ) { ... }
}

export class While extends Stmt {
  constructor(
    public readonly condition: Expr,
    public readonly body: Stmt,
  ) { ... }
}
```

No new node for `for` — the `for` loop is desugared into a `while` during parsing.

### New `Expr` nodes in `src/lox/Expr.ts`

```typescript
export class Logical extends Expr {
  constructor(
    public readonly left: Expr,
    public readonly operator: Token,
    public readonly right: Expr,
  ) { ... }
}
```

Add `visitLogicalExpr(expr: Expr.Logical): R` to the visitor interface.

### Update `src/lox/Parser.ts`

Add:
- `ifStatement()`: parse `if ( expr ) stmt ( else stmt )?`
- `whileStatement()`: parse `while ( expr ) stmt`
- `forStatement()`: parse `for ( init ; cond ; incr ) body`, then **desugar** into:
  ```
  Block([
    init,            // optional
    While(
      cond ?? Literal(true),
      Block([body, Stmt.Expression(incr)])  // incr optional
    )
  ])
  ```
- Update `assignment()` to call `or()`
- `or()`: parse `and ( "or" and )*` → `Expr.Logical`
- `and()`: parse `equality ( "and" equality )*` → `Expr.Logical`
- Update `statement()` to dispatch `if`, `while`, `for`

### Update `src/lox/Interpreter.ts`

```typescript
visitIfStmt(stmt: Stmt.If): void {
  if (this.isTruthy(this.evaluate(stmt.condition))) {
    this.execute(stmt.thenBranch);
  } else if (stmt.elseBranch !== null) {
    this.execute(stmt.elseBranch);
  }
}

visitWhileStmt(stmt: Stmt.While): void {
  while (this.isTruthy(this.evaluate(stmt.condition))) {
    this.execute(stmt.body);
  }
}

visitLogicalExpr(expr: Expr.Logical): LoxValue {
  const left = this.evaluate(expr.left);
  if (expr.operator.type === TokenType.OR) {
    if (this.isTruthy(left)) return left;  // short-circuit
  } else {
    if (!this.isTruthy(left)) return left; // short-circuit
  }
  return this.evaluate(expr.right);
}
```

Note: `and`/`or` return the **actual value** that determined the result, not
`true`/`false`. This is the standard Lox/Lua-style truthiness semantics.

---

## Tests to Write

Create `tests/lox/ControlFlow.test.ts`:

```typescript
// (same run() helper as in Statements.test.ts — consider extracting to a shared helper)

describe('if/else', () => {
  it('executes then branch when condition is true', () => {
    expect(run('if (true) print "yes";')).toEqual(['yes']);
  });

  it('skips then branch when condition is false', () => {
    expect(run('if (false) print "yes";')).toEqual([]);
  });

  it('executes else branch when condition is false', () => {
    expect(run('if (false) print "yes"; else print "no";')).toEqual(['no']);
  });

  it('if with block', () => {
    expect(run('if (true) { print 1; print 2; }')).toEqual(['1', '2']);
  });

  it('dangling else binds to nearest if', () => {
    // if (true) if (false) print "a"; else print "b";
    // Should print "b" (else binds to inner if)
    expect(run('if (true) if (false) print "a"; else print "b";')).toEqual(['b']);
  });
});

describe('while', () => {
  it('executes body while condition is true', () => {
    expect(run('var i = 0; while (i < 3) { print i; i = i + 1; }')).toEqual(['0', '1', '2']);
  });

  it('does not execute if condition is initially false', () => {
    expect(run('while (false) print "x";')).toEqual([]);
  });
});

describe('for loop', () => {
  it('counts from 0 to 2', () => {
    expect(run('for (var i = 0; i < 3; i = i + 1) print i;')).toEqual(['0', '1', '2']);
  });

  it('supports for with no initializer', () => {
    expect(run('var i = 0; for (; i < 2; i = i + 1) print i;')).toEqual(['0', '1']);
  });

  it('supports for with no increment', () => {
    expect(run('for (var i = 0; i < 2;) { print i; i = i + 1; }')).toEqual(['0', '1']);
  });

  it('for loop body variable is scoped to block', () => {
    // The loop variable i should not be accessible after the loop
    // (because for desugars to a block)
    expect(run('for (var i = 0; i < 1; i = i + 1) print i;')).toEqual(['0']);
  });
});

describe('logical operators', () => {
  it('and returns right value when left is truthy', () => {
    expect(run('print (1 and 2);')).toEqual(['2']);
  });

  it('and returns left value when left is falsy (short-circuit)', () => {
    expect(run('print (false and "never");')).toEqual(['false']);
  });

  it('or returns left value when left is truthy (short-circuit)', () => {
    expect(run('print ("yes" or "no");')).toEqual(['yes']);
  });

  it('or returns right value when left is falsy', () => {
    expect(run('print (false or "fallback");')).toEqual(['fallback']);
  });

  it('nil is falsy in and', () => {
    expect(run('print (nil and "x");')).toEqual(['nil']);
  });
});
```

---

## Acceptance Criteria

- [ ] All control flow tests pass
- [ ] `for` loop correctly desugars into `while` — the loop variable is block-scoped
- [ ] `and`/`or` use short-circuit evaluation (right side not evaluated when unnecessary)
- [ ] `and`/`or` return the actual deciding value, not `true`/`false`
- [ ] Dangling `else` binds to the nearest `if`
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- For the `for` desugar: if there is no condition clause, use `new Expr.Literal(true)` as the condition (infinite loop that must be broken — but we don't have `break` yet).
- If there is no initializer, don't wrap in a `Block` — just return the `While` statement directly.
- `Stmt.If` and `Stmt.While` must be added to the `StmtVisitor` interface, and the `Interpreter` must implement both visitor methods.
- Commit with message: `feat(lox): add if/else, while, for, and logical operators`
