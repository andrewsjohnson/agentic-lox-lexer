# Step 16 — Types of Values

**Book reference**: Chapter 18 — Types of Values
**Builds on**: Step 15 (compiler)

---

## Overview

In the C implementation, Lox values are represented as a tagged union struct
(with a type tag and a union payload). In TypeScript we already have dynamic
types, so our `VmValue` type is naturally a union. However, this step formalizes
the value representation, adds runtime type checking, and extends the compiler
and VM to properly handle `nil`, `true`, `false`, and numbers in the same value
pool.

This step is mostly already done from previous steps. The key additions are:
- Proper value type predicates
- `printValue` formatting to match Lox semantics (integer formatting)
- Adding `OP_NIL`, `OP_TRUE`, `OP_FALSE` to the compiler's parse table
- Making sure the VM correctly distinguishes types in equality and truthiness checks

---

## What to Implement

### Expand `src/vm/Value.ts`

Add type guard functions:

```typescript
export function isNil(v: VmValue): v is null {
  return v === null;
}

export function isBool(v: VmValue): v is boolean {
  return typeof v === 'boolean';
}

export function isNumber(v: VmValue): v is number {
  return typeof v === 'number';
}

export function isString(v: VmValue): v is string {
  return typeof v === 'string';
}

export function printValue(v: VmValue): string {
  if (v === null) return 'nil';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    // Lox prints 1.0 as "1", 1.5 as "1.5"
    return Number.isInteger(v) ? String(v) : String(v);
  }
  if (typeof v === 'string') return v;
  // Object types handled in later steps
  if (typeof v === 'object' && v !== null) return v.toString();
  return 'nil';
}

export function valuesEqual(a: VmValue, b: VmValue): boolean {
  // Type mismatch: not equal (no implicit coercion in Lox)
  if (typeof a !== typeof b) {
    if (!(a === null || b === null)) return false;
    return a === b;
  }
  return a === b;
}
```

### Update `src/vm/Compiler.ts`

Add `literal()` parse function and register `true`, `false`, `nil` tokens in
the parse rules table:

```typescript
// In the parse rules table:
[TokenType.TRUE]:  { prefix: this.literal, infix: null, precedence: Precedence.NONE },
[TokenType.FALSE]: { prefix: this.literal, infix: null, precedence: Precedence.NONE },
[TokenType.NIL]:   { prefix: this.literal, infix: null, precedence: Precedence.NONE },
```

### Verify `src/vm/VM.ts`

Ensure the VM correctly:
- Handles `OP_NIL`, `OP_TRUE`, `OP_FALSE`
- Uses `valuesEqual` for `OP_EQUAL`
- Uses `isTruthy` based on Lox semantics (nil and false are falsy; everything else is truthy, **including 0 and ""**)

---

## Tests to Write

Create `tests/vm/Values.test.ts`:

```typescript
import { printValue, valuesEqual, isBool, isNumber, isNil, isString } from '../../src/vm/Value';
import { VM, InterpretResult } from '../../src/vm/VM';

describe('printValue', () => {
  it('prints nil as "nil"', () => expect(printValue(null)).toBe('nil'));
  it('prints true as "true"', () => expect(printValue(true)).toBe('true'));
  it('prints false as "false"', () => expect(printValue(false)).toBe('false'));
  it('prints integer without decimal', () => expect(printValue(42)).toBe('42'));
  it('prints float with decimal', () => expect(printValue(3.14)).toBe('3.14'));
  it('prints string as-is', () => expect(printValue('hello')).toBe('hello'));
  it('prints 1.0 as "1" (not "1.0")', () => expect(printValue(1.0)).toBe('1'));
});

describe('valuesEqual', () => {
  it('nil == nil', () => expect(valuesEqual(null, null)).toBe(true));
  it('nil != false', () => expect(valuesEqual(null, false)).toBe(false));
  it('true == true', () => expect(valuesEqual(true, true)).toBe(true));
  it('false != true', () => expect(valuesEqual(false, true)).toBe(false));
  it('1 == 1', () => expect(valuesEqual(1, 1)).toBe(true));
  it('1 != 2', () => expect(valuesEqual(1, 2)).toBe(false));
  it('"a" == "a"', () => expect(valuesEqual('a', 'a')).toBe(true));
  it('"a" != "b"', () => expect(valuesEqual('a', 'b')).toBe(false));
  it('1 != "1" (different types)', () => expect(valuesEqual(1, '1' as unknown as number)).toBe(false));
});

describe('type guards', () => {
  it('isNil works', () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(false)).toBe(false);
  });
  it('isBool works', () => {
    expect(isBool(true)).toBe(true);
    expect(isBool(1)).toBe(false);
  });
  it('isNumber works', () => {
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber('3')).toBe(false);
  });
  it('isString works', () => {
    expect(isString('hi')).toBe(true);
    expect(isString(1)).toBe(false);
  });
});

describe('VM — value types via compiler', () => {
  function run(source: string) {
    return new VM().interpretSource(source);
  }

  it('nil literal compiles and runs', () => expect(run('nil')).toBe(InterpretResult.OK));
  it('true literal compiles and runs', () => expect(run('true')).toBe(InterpretResult.OK));
  it('false literal compiles and runs', () => expect(run('false')).toBe(InterpretResult.OK));
  it('!true == false', () => expect(run('!true')).toBe(InterpretResult.OK));
  it('!nil == true', () => expect(run('!nil')).toBe(InterpretResult.OK));
  it('0 is truthy (so !0 == false)', () => expect(run('!0')).toBe(InterpretResult.OK));
  it('1 == 1', () => expect(run('1 == 1')).toBe(InterpretResult.OK));
  it('nil == nil', () => expect(run('nil == nil')).toBe(InterpretResult.OK));
  it('nil != false', () => expect(run('nil == false')).toBe(InterpretResult.OK));
});
```

---

## Acceptance Criteria

- [ ] All value type tests pass
- [ ] `printValue(1.0)` returns `"1"` (no `.0`)
- [ ] `valuesEqual(null, false)` returns `false` (no type coercion)
- [ ] `!0` evaluates to `false` (0 is truthy in Lox)
- [ ] `!nil` evaluates to `true`
- [ ] All type guards (`isNil`, `isBool`, `isNumber`, `isString`) work correctly
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- In TypeScript, `typeof null === 'object'` — handle this carefully in type guards. Use `v === null` explicitly for nil checks.
- The `valuesEqual` function must handle the case where `a` and `b` have different JavaScript types but are not both null — they should be unequal in Lox.
- Commit with message: `feat(vm): formalize value types and type predicates`
