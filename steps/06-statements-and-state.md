# Step 06 — Statements and State

**Book reference**: Chapter 8 — Statements and State
**Builds on**: Step 05 (interpreter)

---

## Overview

Up to now, the interpreter only handles expressions. This step adds:
1. **Statements** — `print`, expression statements, variable declarations, block statements
2. **Variables** — `var` declarations, variable expressions, assignment
3. **Environments** — a scope chain for variable storage

After this step, programs can declare and use variables, print values, and
execute sequences of statements.

---

## Grammar Additions

```
program     → declaration* EOF
declaration → varDecl | statement
statement   → exprStmt | printStmt | block
exprStmt    → expression ";"
printStmt   → "print" expression ";"
block       → "{" declaration* "}"
varDecl     → "var" IDENTIFIER ( "=" expression )? ";"

expression  → assignment
assignment  → IDENTIFIER "=" assignment | equality
```

New expression types:
```
primary → ... | IDENTIFIER
```

---

## What to Implement

### `src/lox/Stmt.ts`

Define statement AST nodes using the same namespace + visitor pattern as `Expr`:

```typescript
export interface StmtVisitor<R> {
  visitExpressionStmt(stmt: Stmt.Expression): R;
  visitPrintStmt(stmt: Stmt.Print): R;
  visitVarStmt(stmt: Stmt.Var): R;
  visitBlockStmt(stmt: Stmt.Block): R;
}

export abstract class Stmt {
  abstract accept<R>(visitor: StmtVisitor<R>): R;
}

export namespace Stmt {
  export class Expression extends Stmt {
    constructor(public readonly expression: Expr) { ... }
  }
  export class Print extends Stmt {
    constructor(public readonly expression: Expr) { ... }
  }
  export class Var extends Stmt {
    constructor(
      public readonly name: Token,
      public readonly initializer: Expr | null,
    ) { ... }
  }
  export class Block extends Stmt {
    constructor(public readonly statements: Stmt[]) { ... }
  }
}
```

### New expression nodes in `src/lox/Expr.ts`

Add to the `Expr` namespace:

```typescript
export class Variable extends Expr {
  constructor(public readonly name: Token) { ... }
}

export class Assign extends Expr {
  constructor(
    public readonly name: Token,
    public readonly value: Expr,
  ) { ... }
}
```

Add corresponding visitor methods:
```typescript
visitVariableExpr(expr: Expr.Variable): R;
visitAssignExpr(expr: Expr.Assign): R;
```

### `src/lox/Environment.ts`

```typescript
export class Environment {
  private values = new Map<string, LoxValue>();

  constructor(public readonly enclosing: Environment | null = null) {}

  define(name: string, value: LoxValue): void { ... }

  get(name: Token): LoxValue {
    if (this.values.has(name.lexeme)) return this.values.get(name.lexeme)!;
    if (this.enclosing) return this.enclosing.get(name);
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }

  assign(name: Token, value: LoxValue): void {
    if (this.values.has(name.lexeme)) {
      this.values.set(name.lexeme, value);
      return;
    }
    if (this.enclosing) {
      this.enclosing.assign(name, value);
      return;
    }
    throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
  }
}
```

### Update `src/lox/Parser.ts`

Add parsing methods for:
- `declaration()` — try `varDeclaration()`, fall back to `statement()`
- `varDeclaration()` — parse `var IDENTIFIER (= expr)? ;`
- `statement()` — dispatch to `printStatement()`, `block()`, or `expressionStatement()`
- `printStatement()` — parse `print expr ;`
- `block()` — parse `{ declaration* }`
- `expressionStatement()` — parse `expr ;`
- Update `assignment()` — parse `IDENTIFIER = assignment` or fall through to `equality()`

Change `parse()` to return `Stmt[]` (a list of statements):
```typescript
parse(): Stmt[] { ... }
```

### Update `src/lox/Interpreter.ts`

Implement `StmtVisitor<void>` in addition to `Expr.Visitor<LoxValue>`:

```typescript
class Interpreter implements Expr.Visitor<LoxValue>, StmtVisitor<void> {
  private environment = new Environment();

  interpret(statements: Stmt[]): void { ... }

  visitExpressionStmt(stmt: Stmt.Expression): void { ... }
  visitPrintStmt(stmt: Stmt.Print): void {
    const value = this.evaluate(stmt.expression);
    console.log(this.stringify(value));
  }
  visitVarStmt(stmt: Stmt.Var): void { ... }
  visitBlockStmt(stmt: Stmt.Block): void { ... }
  visitVariableExpr(expr: Expr.Variable): LoxValue { ... }
  visitAssignExpr(expr: Expr.Assign): LoxValue { ... }

  private executeBlock(statements: Stmt[], environment: Environment): void { ... }
}
```

`executeBlock` temporarily replaces `this.environment` with the block's
environment, executes all statements, then restores the previous environment.

### Update `src/lox/Lox.ts`

Wire together scanner → parser → interpreter. Accept either a file path
(`process.argv[2]`) or start a REPL if no argument is given.

For file mode:
```typescript
function runFile(path: string): void {
  const source = fs.readFileSync(path, 'utf-8');
  run(source);
}
```

For REPL mode (interactive line-by-line):
```typescript
function runPrompt(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => run(line));
}
```

---

## Tests to Write

Create `tests/lox/Statements.test.ts`:

```typescript
import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { RuntimeError } from '../../src/lox/RuntimeError';

function run(source: string): string[] {
  // Capture console.log output during interpretation
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args) => output.push(args.join(' '));

  try {
    const scanner = new Scanner(source);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens);
    const stmts = parser.parse();
    const interpreter = new Interpreter();
    interpreter.interpret(stmts);
  } finally {
    console.log = originalLog;
  }
  return output;
}

describe('Print statements', () => {
  it('prints a number', () => {
    expect(run('print 42;')).toEqual(['42']);
  });

  it('prints a string', () => {
    expect(run('print "hello";')).toEqual(['hello']);
  });

  it('prints nil', () => {
    expect(run('print nil;')).toEqual(['nil']);
  });

  it('prints true and false', () => {
    expect(run('print true;')).toEqual(['true']);
    expect(run('print false;')).toEqual(['false']);
  });

  it('prints 1.0 as "1" (not "1.0")', () => {
    expect(run('print 1.0;')).toEqual(['1']);
  });
});

describe('Variable declarations', () => {
  it('declares a variable and prints it', () => {
    expect(run('var x = 10; print x;')).toEqual(['10']);
  });

  it('declares a variable without initializer (nil)', () => {
    expect(run('var x; print x;')).toEqual(['nil']);
  });

  it('assigns to a variable', () => {
    expect(run('var x = 1; x = 2; print x;')).toEqual(['2']);
  });

  it('throws RuntimeError on undefined variable', () => {
    expect(() => run('print x;')).toThrow(RuntimeError);
  });
});

describe('Block scoping', () => {
  it('inner scope can read outer variable', () => {
    expect(run('var x = 1; { print x; }')).toEqual(['1']);
  });

  it('inner variable shadows outer', () => {
    expect(run('var x = 1; { var x = 2; print x; } print x;')).toEqual(['2', '1']);
  });

  it('inner assignment affects outer scope', () => {
    expect(run('var x = 1; { x = 2; } print x;')).toEqual(['2']);
  });
});

describe('Multiple statements', () => {
  it('executes statements sequentially', () => {
    expect(run('print 1; print 2; print 3;')).toEqual(['1', '2', '3']);
  });
});
```

---

## Acceptance Criteria

- [ ] All statement tests pass
- [ ] Block scoping works correctly (inner scope doesn't leak to outer)
- [ ] `print 1.0;` outputs `1` (no trailing `.0`)
- [ ] Assigning to an undeclared variable throws `RuntimeError`
- [ ] Reading an undeclared variable throws `RuntimeError`
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- `executeBlock` must save and restore `this.environment` even if an exception is thrown — use `try/finally`.
- Variable declaration with no initializer assigns `null` (Lox nil).
- Assignment is right-associative: `a = b = c` should parse as `a = (b = c)`.
- Commit with message: `feat(lox): add statements, variables, and block scoping`
