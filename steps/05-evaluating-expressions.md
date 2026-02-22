# Step 05 — Evaluating Expressions

**Book reference**: Chapter 7 — Evaluating Expressions
**Builds on**: Step 04 (parser)

---

## Overview

The **interpreter** walks the AST and evaluates each node to produce a runtime
value. This step implements the tree-walk evaluation of all expression types
defined so far: literals, groupings, unary operators, and binary operators.

After this step, `1 + 2` produces `3`, `"a" + "b"` produces `"ab"`, and
runtime errors (like dividing by zero or adding a string to a number) are
reported with a helpful message.

---

## Runtime Values

Define `LoxValue` as the union type of all possible Lox runtime values:

```typescript
export type LoxValue = null | boolean | number | string;
```

(Callables and instances are added in Steps 08–10.)

**Truthiness rules** (Lox-specific):
- `nil` (`null`) is falsy
- `false` (boolean) is falsy
- Everything else is truthy (including `0` and `""`)

**Equality rules**:
- `nil == nil` is `true`
- `nil == <anything else>` is `false`
- Values of different types are never equal
- Same type: use structural equality

---

## What to Implement

### `src/lox/RuntimeError.ts`

```typescript
import { Token } from './Token';

export class RuntimeError extends Error {
  constructor(
    public readonly token: Token,
    message: string,
  ) {
    super(message);
  }
}
```

### `src/lox/Interpreter.ts`

Implement `Expr.Visitor<LoxValue>`:

```typescript
export class Interpreter implements Expr.Visitor<LoxValue> {
  interpret(expr: Expr): LoxValue { ... }

  visitLiteralExpr(expr: Expr.Literal): LoxValue { ... }
  visitGroupingExpr(expr: Expr.Grouping): LoxValue { ... }
  visitUnaryExpr(expr: Expr.Unary): LoxValue { ... }
  visitBinaryExpr(expr: Expr.Binary): LoxValue { ... }

  private evaluate(expr: Expr): LoxValue { ... }
  private isTruthy(value: LoxValue): boolean { ... }
  private isEqual(a: LoxValue, b: LoxValue): boolean { ... }
  private checkNumberOperand(operator: Token, operand: LoxValue): void { ... }
  private checkNumberOperands(operator: Token, left: LoxValue, right: LoxValue): void { ... }
  private stringify(value: LoxValue): string { ... }
}
```

**Unary operators:**
- `-`: negate a number; throw `RuntimeError` if operand is not a number
- `!`: return `!isTruthy(value)`

**Binary operators:**
- `+`: if both numbers → sum; if both strings → concatenate; otherwise → `RuntimeError`
- `-`, `*`: require both numbers
- `/`: require both numbers; check for division by zero
- `>`, `>=`, `<`, `<=`: require both numbers
- `==`, `!=`: use `isEqual()` (no type coercion)

**`stringify(value)`**: Convert a `LoxValue` to a display string.
- `null` → `"nil"`
- `true` → `"true"`, `false` → `"false"`
- numbers: if the result is a whole number (`1.0`), display as `"1"` (no `.0`)
- strings: return as-is

---

## Tests to Write

Create `tests/lox/Interpreter.test.ts`:

```typescript
import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { RuntimeError } from '../../src/lox/RuntimeError';

function evaluate(source: string) {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const expr = parser.parse()!;
  const interpreter = new Interpreter();
  return interpreter.interpret(expr);
}

describe('Interpreter — literals', () => {
  it('evaluates a number', () => {
    expect(evaluate('42')).toBe(42);
  });

  it('evaluates a string', () => {
    expect(evaluate('"hello"')).toBe('hello');
  });

  it('evaluates true', () => {
    expect(evaluate('true')).toBe(true);
  });

  it('evaluates false', () => {
    expect(evaluate('false')).toBe(false);
  });

  it('evaluates nil', () => {
    expect(evaluate('nil')).toBeNull();
  });
});

describe('Interpreter — arithmetic', () => {
  it('adds two numbers', () => {
    expect(evaluate('1 + 2')).toBe(3);
  });

  it('subtracts', () => {
    expect(evaluate('10 - 4')).toBe(6);
  });

  it('multiplies', () => {
    expect(evaluate('3 * 4')).toBe(12);
  });

  it('divides', () => {
    expect(evaluate('10 / 2')).toBe(5);
  });

  it('respects precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
  });

  it('negates a number', () => {
    expect(evaluate('-5')).toBe(-5);
  });
});

describe('Interpreter — string concatenation', () => {
  it('concatenates two strings with +', () => {
    expect(evaluate('"hello" + " world"')).toBe('hello world');
  });
});

describe('Interpreter — comparison', () => {
  it('1 < 2 is true', () => {
    expect(evaluate('1 < 2')).toBe(true);
  });

  it('2 > 3 is false', () => {
    expect(evaluate('2 > 3')).toBe(false);
  });

  it('1 <= 1 is true', () => {
    expect(evaluate('1 <= 1')).toBe(true);
  });

  it('2 >= 3 is false', () => {
    expect(evaluate('2 >= 3')).toBe(false);
  });
});

describe('Interpreter — equality', () => {
  it('1 == 1 is true', () => {
    expect(evaluate('1 == 1')).toBe(true);
  });

  it('1 != 2 is true', () => {
    expect(evaluate('1 != 2')).toBe(true);
  });

  it('nil == nil is true', () => {
    expect(evaluate('nil == nil')).toBe(true);
  });

  it('nil != false (different types)', () => {
    expect(evaluate('nil == false')).toBe(false);
  });
});

describe('Interpreter — truthiness and logical not', () => {
  it('!false is true', () => {
    expect(evaluate('!false')).toBe(true);
  });

  it('!nil is true', () => {
    expect(evaluate('!nil')).toBe(true);
  });

  it('!true is false', () => {
    expect(evaluate('!true')).toBe(false);
  });

  it('!0 is false (0 is truthy in Lox)', () => {
    expect(evaluate('!0')).toBe(false);
  });
});

describe('Interpreter — runtime errors', () => {
  it('throws RuntimeError when negating non-number', () => {
    expect(() => evaluate('-"hello"')).toThrow(RuntimeError);
  });

  it('throws RuntimeError when adding number to string', () => {
    expect(() => evaluate('1 + "x"')).toThrow(RuntimeError);
  });

  it('throws RuntimeError on division by zero', () => {
    expect(() => evaluate('1 / 0')).toThrow(RuntimeError);
  });

  it('throws RuntimeError comparing non-numbers', () => {
    expect(() => evaluate('"a" > "b"')).toThrow(RuntimeError);
  });
});

describe('Interpreter — stringify', () => {
  it('formats integer-valued doubles without .0', () => {
    // 1.0 should display as "1"
    const interp = new Interpreter();
    // Access stringify indirectly through a test helper or make it public
    expect(evaluate('1.0')).toBe(1); // internal value
    // The number 1.0 == 1.0 in JS; stringify is tested in Step 06 via print
  });
});
```

---

## Acceptance Criteria

- [ ] All interpreter tests pass
- [ ] `RuntimeError` is thrown (not just returned) on type mismatches
- [ ] Truthiness follows Lox semantics (`0` and `""` are truthy)
- [ ] Division by zero throws `RuntimeError`
- [ ] No TypeScript errors

---

## Notes

- Division by zero: check `right === 0` before dividing and throw `RuntimeError`.
- TypeScript number formatting: `Number.isInteger(n) ? String(n) : String(n)` — actually just `String(1.0)` in JS gives `"1"`, so number formatting is automatic for integers. Be careful with `String(1.5)` → `"1.5"` which is correct.
- The `interpret()` method should catch `RuntimeError` internally and return `null`, OR it should propagate it to the caller. In Step 06, when we add `print` statements, we'll want to catch errors at the statement level. For now, propagate them.
- Commit with message: `feat(lox): implement tree-walk expression evaluator`
