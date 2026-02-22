# Step 17 — Strings in the VM

**Book reference**: Chapter 19 — Strings
**Builds on**: Step 16 (types of values)

---

## Overview

This step adds **string support** to the bytecode VM. Strings in the book's C
implementation are heap-allocated objects with pointer identity for interning.
In TypeScript, strings are primitives, so interning is free (JavaScript engines
intern strings). We still need to:

1. Make the compiler emit string constants correctly (strip quotes, handle escape sequences)
2. Support `+` for string concatenation in the VM
3. Test string operations thoroughly

---

## What to Implement

### Update `src/vm/Compiler.ts` — string literals

Add a `string()` parse function:

```typescript
private string(): void {
  // The lexeme includes surrounding quotes: "hello"
  // We need to strip the quotes and handle escape sequences.
  const raw = getLexeme(this.source, this.previous);
  // Strip surrounding quotes
  const content = raw.slice(1, raw.length - 1);
  // Process escape sequences (basic support)
  const value = content
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"');
  this.emitConstant(value);
}
```

Register in parse rules:
```typescript
[TokenType.STRING]: { prefix: this.string, infix: null, precedence: Precedence.NONE },
```

### Update `src/vm/VM.ts` — string concatenation

The `OP_ADD` handler already calls `binaryAdd()`, which handles string + string.
Verify:
- `"a" + "b"` → `"ab"` ✓
- `"a" + 1` → runtime error ✓
- `1 + "a"` → runtime error ✓

### Update `src/vm/Value.ts` — string printing

`printValue` for strings should return the string content (not quoted):
```typescript
if (typeof v === 'string') return v; // already done
```

### String interning note

JavaScript interns short strings automatically. For this educational
implementation, we don't need to implement a separate interning table —
JavaScript's `===` comparison works correctly for string equality.

If you want to simulate the book's interning behavior for learning purposes,
you can add an optional `StringTable` class:

```typescript
export class StringTable {
  private table = new Map<string, string>();

  intern(s: string): string {
    if (this.table.has(s)) return this.table.get(s)!;
    this.table.set(s, s);
    return s;
  }
}
```

This is optional but helps understand what the book implements in Chapter 19-20.

---

## Tests to Write

Create `tests/vm/Strings.test.ts`:

```typescript
import { VM, InterpretResult } from '../../src/vm/VM';

function run(source: string): InterpretResult {
  return new VM().interpretSource(source);
}

function capture(source: string): string[] {
  const out: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...a) => out.push(a.join(' ')));
  new VM().interpretSource(source);
  spy.mockRestore();
  return out;
}

describe('String literals', () => {
  it('compiles a string constant', () => {
    expect(run('"hello"')).toBe(InterpretResult.OK);
  });

  it('compiles an empty string', () => {
    expect(run('""')).toBe(InterpretResult.OK);
  });
});

describe('String concatenation', () => {
  it('concatenates two strings', () => {
    // After Step 19 (print statement), use: capture('print "a" + "b";')
    expect(run('"a" + "b"')).toBe(InterpretResult.OK);
  });

  it('runtime error when adding number to string', () => {
    expect(run('1 + "x"')).toBe(InterpretResult.RUNTIME_ERROR);
  });

  it('runtime error when adding string to number', () => {
    expect(run('"x" + 1')).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('String equality', () => {
  it('"abc" == "abc" is true', () => {
    expect(run('"abc" == "abc"')).toBe(InterpretResult.OK);
  });

  it('"abc" != "def"', () => {
    expect(run('"abc" != "def"')).toBe(InterpretResult.OK);
  });
});

describe('String + print (requires Step 19)', () => {
  // Skip these tests if print statement is not yet implemented.
  // They serve as integration tests.
  it.skip('prints a string', () => {
    expect(capture('print "hello";')).toEqual(['hello']);
  });

  it.skip('prints concatenated string', () => {
    expect(capture('print "Hello, " + "world!";')).toEqual(['Hello, world!']);
  });
});
```

---

## Acceptance Criteria

- [ ] All string tests pass
- [ ] String literals compile correctly (quotes stripped)
- [ ] String concatenation works with `+`
- [ ] Type mismatch in `+` produces `RUNTIME_ERROR`
- [ ] String equality uses `===` (value equality, works correctly in JS)
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The `it.skip` tests for print will be unskipped in Step 19 when print statements are added to the compiler.
- In the book, strings are interned (so identity comparison works for equality). In TypeScript, JavaScript string `===` already compares by value, which gives the correct result.
- Multi-line strings: Lox allows strings to span multiple lines. The scanner already handles this (increments line count on `\n` inside a string).
- Commit with message: `feat(vm): add string literals and concatenation to VM`
