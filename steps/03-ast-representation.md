# Step 03 — Representing Code (AST)

**Book reference**: Chapter 5 — Representing Code
**Builds on**: Step 02 (scanner)

---

## Overview

Before we can parse or evaluate Lox code, we need a data structure to represent
it: an **Abstract Syntax Tree (AST)**. This step defines all expression node
types and implements the **Visitor pattern** to traverse them.

We also implement an `AstPrinter` class that can pretty-print an expression
tree as a parenthesized string — useful for debugging.

---

## What to Implement

### `src/lox/Expr.ts`

Define a **Visitor interface** and one class per expression type. Each class
implements an `accept(visitor)` method.

**Expression types to implement:**

| Class | Fields | Example source |
|---|---|---|
| `Expr.Binary` | `left: Expr`, `operator: Token`, `right: Expr` | `1 + 2` |
| `Expr.Grouping` | `expression: Expr` | `(expr)` |
| `Expr.Literal` | `value: LoxLiteral` | `42`, `"hi"`, `true`, `nil` |
| `Expr.Unary` | `operator: Token`, `right: Expr` | `-x`, `!b` |

Where `LoxLiteral = string | number | boolean | null`.

**Visitor interface:**

```typescript
export interface Visitor<R> {
  visitBinaryExpr(expr: Binary): R;
  visitGroupingExpr(expr: Grouping): R;
  visitLiteralExpr(expr: Literal): R;
  visitUnaryExpr(expr: Unary): R;
}
```

**Base abstract class (or interface):**

```typescript
export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R;
}
```

Use a **namespace** to scope the node classes:

```typescript
export namespace Expr {
  export class Binary extends Expr { ... }
  export class Grouping extends Expr { ... }
  export class Literal extends Expr { ... }
  export class Unary extends Expr { ... }
}
```

This allows usage like `new Expr.Binary(...)` and type `Expr.Binary`.

### `src/lox/AstPrinter.ts`

Implement a class that visits an `Expr` tree and returns a parenthesized string
representation. This is for debugging only.

```typescript
export class AstPrinter implements Expr.Visitor<string> {
  print(expr: Expr): string {
    return expr.accept(this);
  }

  visitBinaryExpr(expr: Expr.Binary): string {
    return this.parenthesize(expr.operator.lexeme, expr.left, expr.right);
  }

  visitGroupingExpr(expr: Expr.Grouping): string {
    return this.parenthesize('group', expr.expression);
  }

  visitLiteralExpr(expr: Expr.Literal): string {
    if (expr.value === null) return 'nil';
    return String(expr.value);
  }

  visitUnaryExpr(expr: Expr.Unary): string {
    return this.parenthesize(expr.operator.lexeme, expr.right);
  }

  private parenthesize(name: string, ...exprs: Expr[]): string {
    return `(${name} ${exprs.map(e => e.accept(this)).join(' ')})`;
  }
}
```

---

## Tests to Write

Create `tests/lox/Expr.test.ts`:

```typescript
import { Expr } from '../../src/lox/Expr';
import { AstPrinter } from '../../src/lox/AstPrinter';
import { Token } from '../../src/lox/Token';
import { TokenType } from '../../src/lox/TokenType';

describe('Expr AST nodes', () => {
  it('creates a Literal node', () => {
    const lit = new Expr.Literal(42);
    expect(lit.value).toBe(42);
  });

  it('creates a Unary node', () => {
    const op = new Token(TokenType.MINUS, '-', null, 1);
    const right = new Expr.Literal(3);
    const unary = new Expr.Unary(op, right);
    expect(unary.operator.type).toBe(TokenType.MINUS);
    expect(unary.right).toBe(right);
  });

  it('creates a Binary node', () => {
    const left = new Expr.Literal(1);
    const op = new Token(TokenType.PLUS, '+', null, 1);
    const right = new Expr.Literal(2);
    const binary = new Expr.Binary(left, op, right);
    expect(binary.left).toBe(left);
    expect(binary.right).toBe(right);
    expect(binary.operator.lexeme).toBe('+');
  });

  it('creates a Grouping node', () => {
    const inner = new Expr.Literal('hello');
    const group = new Expr.Grouping(inner);
    expect(group.expression).toBe(inner);
  });

  it('Literal nil value is null', () => {
    const lit = new Expr.Literal(null);
    expect(lit.value).toBeNull();
  });
});

describe('AstPrinter', () => {
  const printer = new AstPrinter();

  it('prints a literal number', () => {
    expect(printer.print(new Expr.Literal(42))).toBe('42');
  });

  it('prints nil', () => {
    expect(printer.print(new Expr.Literal(null))).toBe('nil');
  });

  it('prints a unary expression', () => {
    const op = new Token(TokenType.MINUS, '-', null, 1);
    const expr = new Expr.Unary(op, new Expr.Literal(123));
    expect(printer.print(expr)).toBe('(- 123)');
  });

  it('prints a binary expression', () => {
    const plus = new Token(TokenType.PLUS, '+', null, 1);
    const expr = new Expr.Binary(
      new Expr.Literal(1),
      plus,
      new Expr.Literal(2),
    );
    expect(printer.print(expr)).toBe('(+ 1 2)');
  });

  it('prints a grouped expression', () => {
    const expr = new Expr.Grouping(new Expr.Literal(true));
    expect(printer.print(expr)).toBe('(group true)');
  });

  it('prints the book example: (* (- 123) (group 45.67))', () => {
    // This is the example from Chapter 5 of the book
    const expr = new Expr.Binary(
      new Expr.Unary(
        new Token(TokenType.MINUS, '-', null, 1),
        new Expr.Literal(123),
      ),
      new Token(TokenType.STAR, '*', null, 1),
      new Expr.Grouping(new Expr.Literal(45.67)),
    );
    expect(printer.print(expr)).toBe('(* (- 123) (group 45.67))');
  });
});
```

---

## Acceptance Criteria

- [ ] All AST and AstPrinter tests pass
- [ ] No TypeScript errors
- [ ] The Visitor pattern compiles correctly with generic return type `R`
- [ ] `Expr` namespace exports `Binary`, `Grouping`, `Literal`, `Unary`
- [ ] `AstPrinter` correctly formats the book's example expression

---

## Notes

- TypeScript namespaces work well here to avoid name collisions (e.g., `Expr.Binary` vs a plain `Binary`).
- The `Visitor<R>` generic lets the same visitor infrastructure work for both `AstPrinter` (returns `string`) and `Interpreter` (returns a runtime value) in later steps.
- `LoxLiteral = string | number | boolean | null` — define and export this type from `Expr.ts` for reuse.
- Commit with message: `feat(lox): add AST node types and AstPrinter`
