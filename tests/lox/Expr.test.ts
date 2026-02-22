import { Expr } from '../../src/lox/Expr';
import { AstPrinter } from '../../src/lox/AstPrinter';
import { Token } from '../../src/lox/Token';
import { TokenType } from '../../src/lox/TokenType';

describe('Expr AST nodes', () => {
  it('creates a Literal node', () => {
    const lit = new Expr.Literal(42);
    expect(lit.value).toBe(42);
  });

  it('creates a Unary node', () => {
    const op = new Token(TokenType.MINUS, '-', null, 1);
    const right = new Expr.Literal(3);
    const unary = new Expr.Unary(op, right);
    expect(unary.operator.type).toBe(TokenType.MINUS);
    expect(unary.right).toBe(right);
  });

  it('creates a Binary node', () => {
    const left = new Expr.Literal(1);
    const op = new Token(TokenType.PLUS, '+', null, 1);
    const right = new Expr.Literal(2);
    const binary = new Expr.Binary(left, op, right);
    expect(binary.left).toBe(left);
    expect(binary.right).toBe(right);
    expect(binary.operator.lexeme).toBe('+');
  });

  it('creates a Grouping node', () => {
    const inner = new Expr.Literal('hello');
    const group = new Expr.Grouping(inner);
    expect(group.expression).toBe(inner);
  });

  it('Literal nil value is null', () => {
    const lit = new Expr.Literal(null);
    expect(lit.value).toBeNull();
  });
});

describe('AstPrinter', () => {
  const printer = new AstPrinter();

  it('prints a literal number', () => {
    expect(printer.print(new Expr.Literal(42))).toBe('42');
  });

  it('prints nil', () => {
    expect(printer.print(new Expr.Literal(null))).toBe('nil');
  });

  it('prints a unary expression', () => {
    const op = new Token(TokenType.MINUS, '-', null, 1);
    const expr = new Expr.Unary(op, new Expr.Literal(123));
    expect(printer.print(expr)).toBe('(- 123)');
  });

  it('prints a binary expression', () => {
    const plus = new Token(TokenType.PLUS, '+', null, 1);
    const expr = new Expr.Binary(
      new Expr.Literal(1),
      plus,
      new Expr.Literal(2),
    );
    expect(printer.print(expr)).toBe('(+ 1 2)');
  });

  it('prints a grouped expression', () => {
    const expr = new Expr.Grouping(new Expr.Literal(true));
    expect(printer.print(expr)).toBe('(group true)');
  });

  it('prints the book example: (* (- 123) (group 45.67))', () => {
    // This is the example from Chapter 5 of the book
    const expr = new Expr.Binary(
      new Expr.Unary(
        new Token(TokenType.MINUS, '-', null, 1),
        new Expr.Literal(123),
      ),
      new Token(TokenType.STAR, '*', null, 1),
      new Expr.Grouping(new Expr.Literal(45.67)),
    );
    expect(printer.print(expr)).toBe('(* (- 123) (group 45.67))');
  });
});
