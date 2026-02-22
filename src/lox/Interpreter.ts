import { Expr, Visitor } from './Expr';
import { Stmt, StmtVisitor } from './Stmt';
import { Token } from './Token';
import { TokenType } from './TokenType';
import { RuntimeError } from './RuntimeError';
import { Environment } from './Environment';

export type LoxValue = null | boolean | number | string;

export class Interpreter implements Visitor<LoxValue>, StmtVisitor<void> {
  private environment = new Environment();

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

  visitVariableExpr(expr: Expr.Variable): LoxValue {
    return this.environment.get(expr.name);
  }

  visitAssignExpr(expr: Expr.Assign): LoxValue {
    const value = this.evaluate(expr.value);
    this.environment.assign(expr.name, value);
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

  private execute(stmt: Stmt): void {
    stmt.accept(this);
  }

  private executeBlock(statements: Stmt[], environment: Environment): void {
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
    return value;
  }
}
