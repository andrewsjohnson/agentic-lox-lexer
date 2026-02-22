import { Expr, Visitor } from './Expr';
import { Stmt, StmtVisitor } from './Stmt';
import { Token } from './Token';
import { Interpreter } from './Interpreter';

export class ResolveError extends Error {
  constructor(
    public readonly token: Token,
    message: string,
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

type Scope = Map<string, boolean>;

enum FunctionType {
  NONE,
  FUNCTION,
  INITIALIZER,
}

enum ClassType {
  NONE,
  CLASS,
  SUBCLASS,
}

export class Resolver implements Visitor<void>, StmtVisitor<void> {
  private scopes: Scope[] = [];
  private currentFunction: FunctionType = FunctionType.NONE;
  private currentClass: ClassType = ClassType.NONE;
  public readonly errors: ResolveError[] = [];

  constructor(private readonly interpreter: Interpreter) {}

  resolve(statements: Stmt[]): void {
    for (const statement of statements) {
      this.resolveStmt(statement);
    }
  }

  private resolveStmt(stmt: Stmt): void {
    stmt.accept(this);
  }

  private resolveExpr(expr: Expr): void {
    expr.accept(this);
  }

  // --- Stmt visitors ---
  visitBlockStmt(stmt: Stmt.Block): void {
    this.beginScope();
    this.resolve(stmt.statements);
    this.endScope();
  }

  visitVarStmt(stmt: Stmt.Var): void {
    this.declare(stmt.name);
    if (stmt.initializer !== null) {
      this.resolveExpr(stmt.initializer);
    }
    this.define(stmt.name);
  }

  visitFunctionStmt(stmt: Stmt.Function): void {
    this.declare(stmt.name);
    this.define(stmt.name);
    this.resolveFunction(stmt, FunctionType.FUNCTION);
  }

  visitExpressionStmt(stmt: Stmt.Expression): void {
    this.resolveExpr(stmt.expression);
  }

  visitIfStmt(stmt: Stmt.If): void {
    this.resolveExpr(stmt.condition);
    this.resolveStmt(stmt.thenBranch);
    if (stmt.elseBranch !== null) {
      this.resolveStmt(stmt.elseBranch);
    }
  }

  visitPrintStmt(stmt: Stmt.Print): void {
    this.resolveExpr(stmt.expression);
  }

  visitReturnStmt(stmt: Stmt.Return): void {
    if (this.currentFunction === FunctionType.NONE) {
      this.errors.push(
        new ResolveError(stmt.keyword, "Can't return from top-level code."),
      );
    }
    if (stmt.value !== null) {
      if (this.currentFunction === FunctionType.INITIALIZER) {
        this.errors.push(
          new ResolveError(stmt.keyword, "Can't return a value from an initializer."),
        );
      }
      this.resolveExpr(stmt.value);
    }
  }

  visitClassStmt(stmt: Stmt.Class): void {
    const enclosingClass = this.currentClass;
    this.currentClass = ClassType.CLASS;

    this.declare(stmt.name);
    this.define(stmt.name);

    if (stmt.superclass !== null) {
      if (stmt.superclass.name.lexeme === stmt.name.lexeme) {
        this.errors.push(
          new ResolveError(stmt.superclass.name, "A class can't inherit from itself."),
        );
      }
      this.resolveExpr(stmt.superclass);
      this.currentClass = ClassType.SUBCLASS;
      this.beginScope();
      this.scopes[this.scopes.length - 1].set('super', true);
    }

    this.beginScope();
    this.scopes[this.scopes.length - 1].set('this', true);

    for (const method of stmt.methods) {
      const declaration = method.name.lexeme === 'init'
        ? FunctionType.INITIALIZER
        : FunctionType.FUNCTION;
      this.resolveFunction(method, declaration);
    }

    this.endScope();

    if (stmt.superclass !== null) {
      this.endScope();
    }

    this.currentClass = enclosingClass;
  }

  visitWhileStmt(stmt: Stmt.While): void {
    this.resolveExpr(stmt.condition);
    this.resolveStmt(stmt.body);
  }

  // --- Expr visitors ---
  visitVariableExpr(expr: Expr.Variable): void {
    if (
      this.scopes.length > 0 &&
      this.scopes[this.scopes.length - 1].get(expr.name.lexeme) === false
    ) {
      this.errors.push(
        new ResolveError(
          expr.name,
          "Can't read local variable in its own initializer.",
        ),
      );
    }
    this.resolveLocal(expr, expr.name);
  }

  visitAssignExpr(expr: Expr.Assign): void {
    this.resolveExpr(expr.value);
    this.resolveLocal(expr, expr.name);
  }

  visitBinaryExpr(expr: Expr.Binary): void {
    this.resolveExpr(expr.left);
    this.resolveExpr(expr.right);
  }

  visitCallExpr(expr: Expr.Call): void {
    this.resolveExpr(expr.callee);
    for (const arg of expr.args) {
      this.resolveExpr(arg);
    }
  }

  visitGroupingExpr(expr: Expr.Grouping): void {
    this.resolveExpr(expr.expression);
  }

  visitLiteralExpr(expr: Expr.Literal): void {
    // Literals have no variables to resolve
  }

  visitLogicalExpr(expr: Expr.Logical): void {
    this.resolveExpr(expr.left);
    this.resolveExpr(expr.right);
  }

  visitUnaryExpr(expr: Expr.Unary): void {
    this.resolveExpr(expr.right);
  }

  visitGetExpr(expr: Expr.Get): void {
    this.resolveExpr(expr.object);
  }

  visitSetExpr(expr: Expr.Set): void {
    this.resolveExpr(expr.value);
    this.resolveExpr(expr.object);
  }

  visitThisExpr(expr: Expr.This): void {
    if (this.currentClass === ClassType.NONE) {
      this.errors.push(
        new ResolveError(expr.keyword, "Can't use 'this' outside of a class."),
      );
      return;
    }
    this.resolveLocal(expr, expr.keyword);
  }

  visitSuperExpr(expr: Expr.Super): void {
    if (this.currentClass === ClassType.NONE) {
      this.errors.push(
        new ResolveError(expr.keyword, "Can't use 'super' outside of a class."),
      );
    } else if (this.currentClass !== ClassType.SUBCLASS) {
      this.errors.push(
        new ResolveError(expr.keyword, "Can't use 'super' in a class with no superclass."),
      );
    }
    this.resolveLocal(expr, expr.keyword);
  }

  // --- Helper methods ---
  private beginScope(): void {
    this.scopes.push(new Map());
  }

  private endScope(): void {
    this.scopes.pop();
  }

  private declare(name: Token): void {
    if (this.scopes.length === 0) return;
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name.lexeme)) {
      this.errors.push(
        new ResolveError(
          name,
          "Already a variable with this name in this scope.",
        ),
      );
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
