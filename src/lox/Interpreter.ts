import { Expr, Visitor } from './Expr';
import { Stmt, StmtVisitor } from './Stmt';
import { Token } from './Token';
import { TokenType } from './TokenType';
import { RuntimeError } from './RuntimeError';
import { Environment } from './Environment';
import { LoxCallable, isLoxCallable } from './LoxCallable';
import { Return } from './Return';
import { LoxFunction } from './LoxFunction';
import { LoxClass } from './LoxClass';
import { LoxInstance } from './LoxInstance';

export type LoxValue = null | boolean | number | string | LoxCallable | LoxInstance;

export class Interpreter implements Visitor<LoxValue>, StmtVisitor<void> {
  public readonly globals = new Environment();
  private environment = this.globals;
  private locals = new Map<Expr, number>();

  constructor() {
    this.globals.define('clock', {
      arity: () => 0,
      call: () => Date.now() / 1000,
      toString: () => '<native fn>',
    } satisfies LoxCallable);
  }

  resolve(expr: Expr, depth: number): void {
    this.locals.set(expr, depth);
  }

  interpret(statements: Stmt[]): void {
    for (const statement of statements) {
      this.execute(statement);
    }
  }

  visitExpressionStmt(stmt: Stmt.Expression): void {
    this.evaluate(stmt.expression);
  }

  visitPrintStmt(stmt: Stmt.Print): void {
    const value = this.evaluate(stmt.expression);
    console.log(this.stringify(value));
  }

  visitVarStmt(stmt: Stmt.Var): void {
    const value: LoxValue = stmt.initializer !== null
      ? this.evaluate(stmt.initializer)
      : null;
    this.environment.define(stmt.name.lexeme, value);
  }

  visitBlockStmt(stmt: Stmt.Block): void {
    this.executeBlock(stmt.statements, new Environment(this.environment));
  }

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

  visitFunctionStmt(stmt: Stmt.Function): void {
    const fn = new LoxFunction(stmt, this.environment, false);
    this.environment.define(stmt.name.lexeme, fn);
  }

  visitClassStmt(stmt: Stmt.Class): void {
    let superclass: LoxClass | null = null;
    if (stmt.superclass !== null) {
      const superVal = this.evaluate(stmt.superclass);
      if (!(superVal instanceof LoxClass)) {
        throw new RuntimeError(stmt.superclass.name, 'Superclass must be a class.');
      }
      superclass = superVal;
    }

    this.environment.define(stmt.name.lexeme, null);

    if (superclass !== null) {
      this.environment = new Environment(this.environment);
      this.environment.define('super', superclass);
    }

    const methods = new Map<string, LoxFunction>();
    for (const method of stmt.methods) {
      const fn = new LoxFunction(method, this.environment, method.name.lexeme === 'init');
      methods.set(method.name.lexeme, fn);
    }
    const klass = new LoxClass(stmt.name.lexeme, superclass, methods);

    if (superclass !== null) {
      this.environment = this.environment.enclosing!;
    }

    this.environment.assign(stmt.name, klass);
  }

  visitReturnStmt(stmt: Stmt.Return): void {
    const value = stmt.value ? this.evaluate(stmt.value) : null;
    throw new Return(value);
  }

  visitVariableExpr(expr: Expr.Variable): LoxValue {
    return this.lookUpVariable(expr.name, expr);
  }

  visitAssignExpr(expr: Expr.Assign): LoxValue {
    const value = this.evaluate(expr.value);
    const distance = this.locals.get(expr);
    if (distance !== undefined) {
      this.environment.assignAt(distance, expr.name, value);
    } else {
      this.globals.assign(expr.name, value);
    }
    return value;
  }

  visitLiteralExpr(expr: Expr.Literal): LoxValue {
    return expr.value;
  }

  visitGroupingExpr(expr: Expr.Grouping): LoxValue {
    return this.evaluate(expr.expression);
  }

  visitUnaryExpr(expr: Expr.Unary): LoxValue {
    const right = this.evaluate(expr.right);

    switch (expr.operator.type) {
      case TokenType.MINUS:
        this.checkNumberOperand(expr.operator, right);
        return -(right as number);
      case TokenType.BANG:
        return !this.isTruthy(right);
    }

    return null;
  }

  visitBinaryExpr(expr: Expr.Binary): LoxValue {
    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);

    switch (expr.operator.type) {
      case TokenType.PLUS:
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        if (typeof left === 'string' && typeof right === 'string') {
          return left + right;
        }
        throw new RuntimeError(
          expr.operator,
          'Operands must be two numbers or two strings.',
        );
      case TokenType.MINUS:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) - (right as number);
      case TokenType.STAR:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) * (right as number);
      case TokenType.SLASH:
        this.checkNumberOperands(expr.operator, left, right);
        if ((right as number) === 0) {
          throw new RuntimeError(expr.operator, 'Division by zero.');
        }
        return (left as number) / (right as number);
      case TokenType.GREATER:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) > (right as number);
      case TokenType.GREATER_EQUAL:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) >= (right as number);
      case TokenType.LESS:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) < (right as number);
      case TokenType.LESS_EQUAL:
        this.checkNumberOperands(expr.operator, left, right);
        return (left as number) <= (right as number);
      case TokenType.EQUAL_EQUAL:
        return this.isEqual(left, right);
      case TokenType.BANG_EQUAL:
        return !this.isEqual(left, right);
    }

    return null;
  }

  visitLogicalExpr(expr: Expr.Logical): LoxValue {
    const left = this.evaluate(expr.left);

    if (expr.operator.type === TokenType.OR) {
      if (this.isTruthy(left)) return left;
    } else {
      if (!this.isTruthy(left)) return left;
    }

    return this.evaluate(expr.right);
  }

  visitCallExpr(expr: Expr.Call): LoxValue {
    const callee = this.evaluate(expr.callee);
    const args = expr.args.map(a => this.evaluate(a));

    if (!isLoxCallable(callee)) {
      throw new RuntimeError(expr.paren, 'Can only call functions and classes.');
    }
    if (args.length !== callee.arity()) {
      throw new RuntimeError(expr.paren,
        `Expected ${callee.arity()} arguments but got ${args.length}.`);
    }
    return callee.call(this, args);
  }

  visitGetExpr(expr: Expr.Get): LoxValue {
    const object = this.evaluate(expr.object);
    if (object instanceof LoxInstance) return object.get(expr.name);
    throw new RuntimeError(expr.name, 'Only instances have properties.');
  }

  visitSetExpr(expr: Expr.Set): LoxValue {
    const object = this.evaluate(expr.object);
    if (!(object instanceof LoxInstance)) {
      throw new RuntimeError(expr.name, 'Only instances have fields.');
    }
    const value = this.evaluate(expr.value);
    object.set(expr.name, value);
    return value;
  }

  visitThisExpr(expr: Expr.This): LoxValue {
    return this.lookUpVariable(expr.keyword, expr);
  }

  visitSuperExpr(expr: Expr.Super): LoxValue {
    const distance = this.locals.get(expr)!;
    const superclass = this.environment.getAt(distance, 'super') as LoxClass;
    const object = this.environment.getAt(distance - 1, 'this') as LoxInstance;
    const method = superclass.findMethod(expr.method.lexeme);
    if (!method) {
      throw new RuntimeError(expr.method, `Undefined property '${expr.method.lexeme}'.`);
    }
    return method.bind(object);
  }

  private execute(stmt: Stmt): void {
    stmt.accept(this);
  }

  public executeBlock(statements: Stmt[], environment: Environment): void {
    const previous = this.environment;
    try {
      this.environment = environment;
      for (const statement of statements) {
        this.execute(statement);
      }
    } finally {
      this.environment = previous;
    }
  }

  evaluate(expr: Expr): LoxValue {
    return expr.accept(this);
  }

  private lookUpVariable(name: Token, expr: Expr): LoxValue {
    const distance = this.locals.get(expr);
    if (distance !== undefined) {
      return this.environment.getAt(distance, name.lexeme);
    }
    return this.globals.get(name);
  }

  private isTruthy(value: LoxValue): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return value;
    return true;
  }

  private isEqual(a: LoxValue, b: LoxValue): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a === b;
  }

  private checkNumberOperand(operator: Token, operand: LoxValue): void {
    if (typeof operand === 'number') return;
    throw new RuntimeError(operator, 'Operand must be a number.');
  }

  private checkNumberOperands(
    operator: Token,
    left: LoxValue,
    right: LoxValue,
  ): void {
    if (typeof left === 'number' && typeof right === 'number') return;
    throw new RuntimeError(operator, 'Operands must be numbers.');
  }

  stringify(value: LoxValue): string {
    if (value === null) return 'nil';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') {
      const text = String(value);
      if (text.endsWith('.0')) return text.slice(0, -2);
      return text;
    }
    if (typeof value === 'string') return value;
    if (value instanceof LoxInstance) return value.toString();
    if (isLoxCallable(value)) return value.toString();
    return '';
  }
}
