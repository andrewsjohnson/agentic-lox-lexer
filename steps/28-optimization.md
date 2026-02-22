# Step 28 — Optimization

**Book reference**: Chapter 30 — Optimization
**Builds on**: Step 27 (complete VM)

---

## Overview

This final step adds performance optimizations to the bytecode VM. The book's
chapter covers several techniques:

1. **Benchmark harness** — measure performance with a Fibonacci benchmark
2. **NaN boxing** (C-specific — skip for TypeScript)
3. **`OP_INVOKE` optimization** — already introduced in Step 26 (implement fully here)
4. **Hash table performance** — double-check the Table implementation from Step 18
5. **String interning** — deduplicate string allocations
6. **Constant folding** (optional stretch goal)

---

## What to Implement

### 1. Benchmark Suite

Create `benchmarks/` directory with Lox programs for performance testing:

**`benchmarks/fib.lox`**
```lox
fun fib(n) {
  if (n < 2) return n;
  return fib(n - 2) + fib(n - 1);
}

var start = clock();
print fib(35);
print clock() - start;
```

**`benchmarks/zoo.lox`** (tests method dispatch)
```lox
class Zoo {
  init() {
    this.aardvark = 1;
    this.baboon   = 1;
    this.cat      = 1;
    this.donkey   = 1;
    this.emu      = 1;
    this.fox      = 1;
  }
  ant()    { return this.aardvark; }
  banana() { return this.baboon; }
  tuna()   { return this.cat; }
  hay()    { return this.donkey; }
  grass()  { return this.emu; }
  mouse()  { return this.fox; }
}

var sum = 0;
var start = clock();
var i = 0;
while (i < 10000) {
  var zoo = Zoo();
  sum = sum + zoo.ant() + zoo.banana() + zoo.tuna() +
             zoo.hay() + zoo.grass() + zoo.mouse();
  i = i + 1;
}
print sum;
print clock() - start;
```

**`benchmarks/string_equality.lox`**
```lox
var a = "testing";
var b = "testing";
var start = clock();
var i = 0;
while (i < 100000) {
  if (a == b) {}
  i = i + 1;
}
print clock() - start;
```

### 2. `npm run benchmark` script

Add to `package.json`:
```json
"benchmark": "ts-node src/vm/Clox.ts benchmarks/fib.lox"
```

### 3. Fully implement `OP_INVOKE`

If `OP_INVOKE` was left as a stub in Step 26, implement it fully now.

Update the compiler's `call()` infix parse function to detect the pattern
`expr.method(args)` and emit `OP_INVOKE`:

The approach: when compiling `(` as an infix operator, check if the previous
expression was a property access (`OP_GET_PROPERTY`). If so, **replace** the
emitted `OP_GET_PROPERTY` with `OP_INVOKE` and combine the argument count.

A simpler approach (avoiding the need to scan emitted bytes):

Track a "pending invocation" flag in the compiler:

```typescript
// When parsing '.method', note the method name instead of emitting immediately.
// When the next token is '(', emit OP_INVOKE instead of OP_GET_PROPERTY + OP_CALL.
```

Or use the approach from the book: the dot parse function emits the property
name as a constant; the call parse function checks if the previous operation
was a property access (by inspecting the last emitted byte).

### 4. String Interning Table

Add a `strings` table to the VM for interning:

```typescript
class VM {
  private strings = new Table(); // string interning

  private internString(s: string): string {
    const existing = this.strings.get(s);
    if (existing !== undefined) return existing as string;
    this.strings.set(s, s);
    return s;
  }
}
```

Intern all string constants when they are loaded and when strings are
concatenated. With interning, string equality becomes pointer comparison
(which JavaScript's `===` already does for same-content strings — so this
optimization is already built in, but implement it to match the book).

### 5. Constant Folding (Stretch Goal)

Add a peephole optimization pass in the compiler: if the last `N` instructions
are constant pushes followed by an arithmetic operator, replace them with a
single constant push of the result.

```typescript
private foldConstants(): boolean {
  const code = this.currentChunk().code;
  const n = code.length;
  // Look for: OP_CONSTANT idx1, OP_CONSTANT idx2, OP_ADD/SUBTRACT/etc.
  if (n < 5) return false;
  if (code[n-1] !== OpCode.OP_ADD) return false;
  if (code[n-3] !== OpCode.OP_CONSTANT) return false;
  if (code[n-5] !== OpCode.OP_CONSTANT) return false;
  // ... fold if both constants are numbers
}
```

---

## Tests to Write

Create `tests/vm/Optimization.test.ts`:

```typescript
import { VM, InterpretResult } from '../../src/vm/VM';

function capture(source: string): string[] { /* ... */ }

describe('Fibonacci benchmark (correctness)', () => {
  it('fib(10) = 55', () => {
    expect(capture(`
      fun fib(n) {
        if (n < 2) return n;
        return fib(n - 2) + fib(n - 1);
      }
      print fib(10);
    `)).toEqual(['55']);
  });

  it('fib(20) = 6765', () => {
    expect(capture(`
      fun fib(n) {
        if (n < 2) return n;
        return fib(n - 2) + fib(n - 1);
      }
      print fib(20);
    `)).toEqual(['6765']);
  });
});

describe('Method invocation optimization', () => {
  it('calling a method many times produces correct result', () => {
    expect(capture(`
      class Counter {
        init() { this.n = 0; }
        inc() { this.n = this.n + 1; }
        val() { return this.n; }
      }
      var c = Counter();
      var i = 0;
      while (i < 100) { c.inc(); i = i + 1; }
      print c.val();
    `)).toEqual(['100']);
  });
});

describe('String interning', () => {
  it('string equality is correct for interned strings', () => {
    expect(capture(`
      var a = "hello";
      var b = "hello";
      print a == b;
    `)).toEqual(['true']);
  });

  it('concatenated strings can equal interned strings', () => {
    expect(capture(`
      var a = "hel" + "lo";
      var b = "hello";
      print a == b;
    `)).toEqual(['true']);
  });
});

describe('Full integration — complete Lox programs', () => {
  it('runs a class hierarchy with multiple features', () => {
    const src = `
      class Shape {
        init(color) { this.color = color; }
        describe() { print this.color + " shape"; }
      }

      class Circle < Shape {
        init(color, radius) {
          super.init(color);
          this.radius = radius;
        }
        area() { return 3.14159 * this.radius * this.radius; }
      }

      var c = Circle("red", 5);
      c.describe();
      print c.area() > 78;
    `;
    expect(capture(src)).toEqual(['red shape', 'true']);
  });

  it('closures + classes + inheritance', () => {
    expect(capture(`
      class Adder {
        init(n) { this.n = n; }
        add(x) { return this.n + x; }
      }

      fun makeAdder(n) {
        return Adder(n);
      }

      var add5 = makeAdder(5);
      print add5.add(3);
      print add5.add(10);
    `)).toEqual(['8', '15']);
  });
});
```

---

## Acceptance Criteria

- [ ] All optimization tests pass (correctness, not speed)
- [ ] `fib(20)` returns `6765`
- [ ] String equality is correct for both interned and concatenated strings
- [ ] Benchmark files exist in `benchmarks/`
- [ ] `npm run benchmark` runs without error
- [ ] Integration tests exercise all major features together
- [ ] No TypeScript errors
- [ ] **All 28 steps' tests pass** — run `npm test` for final verification

---

## Final Checklist

After completing this step, the Lox interpreter is **feature-complete** in both
implementations. Run the complete test suite one final time:

```bash
npm test
```

All tests should pass. If any fail, fix them before considering the project done.

**What you've built:**
- A complete tree-walk interpreter for Lox (`src/lox/`) — Steps 01–11
- A complete bytecode virtual machine for Lox (`src/vm/`) — Steps 12–28
- Both implement the full Lox language:
  - Dynamic typing
  - Arithmetic, comparison, logical operators
  - Variables (global and local)
  - Control flow: `if`/`else`, `while`, `for`
  - Functions with closures
  - Classes with inheritance and `super`

**Commit with message**: `feat(vm): add optimizations, benchmarks, and final integration tests — project complete`

---

## Further Reading

- Crafting Interpreters: https://craftinginterpreters.com
- Pratt Parsing: https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
- Mark-Sweep GC: https://en.wikipedia.org/wiki/Tracing_garbage_collection
