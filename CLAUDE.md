# Lox Interpreter in TypeScript — Agent Guide

This repository implements a complete Lox interpreter in TypeScript, following
Robert Nystrom's book *Crafting Interpreters* (https://craftinginterpreters.com).
The implementation is split across two major parts:

- **Part II (Steps 01–11)**: A tree-walk interpreter (`src/lox/`)
- **Part III (Steps 12–28)**: A bytecode virtual machine (`src/vm/`)

---

## How to Use This Repository

Work through the `steps/` directory **sequentially**. Each numbered `.md` file
is a self-contained implementation task. Do not skip steps — each builds on the
previous one.

```
steps/
  01-repository-setup.md
  02-scanning-lexer.md
  03-ast-representation.md
  ...
  28-optimization.md
```

---

## Key Commands

```bash
# Install dependencies (after step 01)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npm test -- --testPathPattern="scanner"

# Build TypeScript
npm run build

# Run the Lox REPL (after step 06+)
npm run lox

# Run a Lox file
npm run lox -- path/to/file.lox

# Run the bytecode VM REPL (after step 13+)
npm run clox

# Typecheck without emitting
npm run typecheck
```

---

## Project Structure

```
src/
  lox/              # Tree-walk interpreter (Part II)
    Token.ts
    TokenType.ts
    Scanner.ts
    Expr.ts
    Stmt.ts
    Parser.ts
    Interpreter.ts
    Environment.ts
    Resolver.ts
    LoxCallable.ts
    LoxFunction.ts
    LoxClass.ts
    LoxInstance.ts
    Lox.ts          # Main entry point for tree-walk interpreter
  vm/               # Bytecode VM (Part III)
    Chunk.ts
    OpCode.ts
    VM.ts
    Compiler.ts
    Scanner.ts      # On-demand scanner for the VM
    Value.ts
    Object.ts
    Table.ts
    Memory.ts
    Clox.ts         # Main entry point for bytecode VM
tests/
  lox/              # Tests for Part II
  vm/               # Tests for Part III
steps/              # Implementation guides (this directory)
```

---

## Coding Conventions

- **TypeScript strict mode** is enabled. All code must typecheck with zero errors.
- Use `interface` for AST node types and `class` for runtime objects.
- The **Visitor pattern** is used extensively in Part II for AST traversal.
- Prefer `readonly` on fields that should not be mutated after construction.
- Do not use `any` — use proper union types or generics.
- Every public function/method in a class should have a return type annotation.

---

## Testing Conventions

- Tests use **Jest** with `ts-jest`.
- Each step adds tests in `tests/lox/` or `tests/vm/`.
- Test files are named after the module they test: `Scanner.test.ts`, `Parser.test.ts`, etc.
- **Do not delete tests from previous steps.** All tests must pass before moving on.
- Use `describe` blocks to group related tests.
- Test error cases as well as happy paths.

---

## Progress Tracking

Implementation progress is recorded in **`PROGRESS.md`** at the repository root.

### At the start of every session

1. Read `PROGRESS.md` to find the **Next Step** section — that tells you exactly
   which step to work on next.
2. Do not scan the source tree or run tests to infer progress; trust
   `PROGRESS.md` as the authoritative record.

### After completing a step

Update `PROGRESS.md` immediately before committing:

1. Change the completed step's status from `⬜ Pending` to `✅ Complete`.
2. Update the **Next Step** section to point at the following step file.
3. Update the **Last updated** date at the top of the file.

Keep the edit minimal — only touch the lines that change.

---

## Step Completion Checklist

Before marking a step as done, verify:

- [ ] All new tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No regressions in previous tests
- [ ] Implementation matches the book's chapter behavior
- [ ] `PROGRESS.md` updated to reflect the completed step

---

## Reference

- Book website: https://craftinginterpreters.com
- Full chapter list: https://craftinginterpreters.com/contents.html
- Each step file references the corresponding book chapter(s).

---

## Notes on TypeScript vs Java/C

The book implements **jlox** in Java and **clox** in C. This repository
implements both in TypeScript. Key differences to be aware of:

- **Lox values** are represented as `LoxValue = null | boolean | number | string | LoxCallable | LoxInstance`
- **Nil** in Lox maps to `null` in TypeScript (not `undefined`)
- The **Visitor pattern** uses TypeScript generics and function overloading
- For the **bytecode VM**, we use `Uint8Array` for bytecode and a typed `Value[]` array for the value stack
- JavaScript's built-in garbage collector handles memory for the tree-walk interpreter; Part III implements a manual mark-sweep GC for educational purposes
- Number formatting: Lox prints `1.0` as `"1"` — strip trailing `.0` when printing
