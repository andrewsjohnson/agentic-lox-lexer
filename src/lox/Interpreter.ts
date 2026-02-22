import { Expr, Visitor } from './Expr';
import { Token } from './Token';
import { TokenType } from './TokenType';
import { RuntimeError } from './RuntimeError';

export type LoxValue = null | boolean | number | string;

export class Interpreter implements Visitor<LoxValue> {
  interpret(expr: Expr): LoxValue {
    return this.evaluate(expr);
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

  private evaluate(expr: Expr): LoxValue {
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
