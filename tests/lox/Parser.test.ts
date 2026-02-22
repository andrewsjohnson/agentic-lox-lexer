import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { AstPrinter } from '../../src/lox/AstPrinter';
import { Expr } from '../../src/lox/Expr';

function parse(source: string): Expr | null {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  return parser.parse();
}

function parseAndPrint(source: string): string {
  const expr = parse(source);
  if (!expr) throw new Error('Parse failed');
  return new AstPrinter().print(expr);
}

describe('Parser — literals', () => {
  it('parses a number literal', () => {
    const expr = parse('42');
    expect(expr).toBeInstanceOf(Expr.Literal);
    expect((expr as Expr.Literal).value).toBe(42);
  });

  it('parses true', () => {
    const expr = parse('true');
    expect(expr).toBeInstanceOf(Expr.Literal);
    expect((expr as Expr.Literal).value).toBe(true);
  });

  it('parses false', () => {
    const expr = parse('false');
    expect((expr as Expr.Literal).value).toBe(false);
  });

  it('parses nil', () => {
    const expr = parse('nil');
    expect((expr as Expr.Literal).value).toBeNull();
  });

  it('parses a string literal', () => {
    const expr = parse('"hello"');
    expect((expr as Expr.Literal).value).toBe('hello');
  });
});

describe('Parser — grouping', () => {
  it('parses a grouped expression', () => {
    const expr = parse('(1)');
    expect(expr).toBeInstanceOf(Expr.Grouping);
  });

  it('parses nested groups', () => {
    expect(() => parseAndPrint('((1 + 2))')).not.toThrow();
  });
});

describe('Parser — unary', () => {
  it('parses negation', () => {
    expect(parseAndPrint('-1')).toBe('(- 1)');
  });

  it('parses logical not', () => {
    expect(parseAndPrint('!true')).toBe('(! true)');
  });

  it('parses double negation', () => {
    expect(parseAndPrint('--1')).toBe('(- (- 1))');
  });
});

describe('Parser — binary arithmetic', () => {
  it('parses addition', () => {
    expect(parseAndPrint('1 + 2')).toBe('(+ 1 2)');
  });

  it('parses subtraction', () => {
    expect(parseAndPrint('5 - 3')).toBe('(- 5 3)');
  });

  it('parses multiplication', () => {
    expect(parseAndPrint('2 * 3')).toBe('(* 2 3)');
  });

  it('parses division', () => {
    expect(parseAndPrint('10 / 2')).toBe('(/ 10 2)');
  });
});

describe('Parser — precedence', () => {
  it('multiplication binds tighter than addition', () => {
    expect(parseAndPrint('1 + 2 * 3')).toBe('(+ 1 (* 2 3))');
  });

  it('grouping overrides precedence', () => {
    expect(parseAndPrint('(1 + 2) * 3')).toBe('(* (group (+ 1 2)) 3)');
  });

  it('unary binds tighter than binary', () => {
    expect(parseAndPrint('-1 + 2')).toBe('(+ (- 1) 2)');
  });
});

describe('Parser — comparison', () => {
  it('parses greater than', () => {
    expect(parseAndPrint('1 > 2')).toBe('(> 1 2)');
  });

  it('parses less than or equal', () => {
    expect(parseAndPrint('1 <= 2')).toBe('(<= 1 2)');
  });
});

describe('Parser — equality', () => {
  it('parses equality', () => {
    expect(parseAndPrint('1 == 1')).toBe('(== 1 1)');
  });

  it('parses inequality', () => {
    expect(parseAndPrint('1 != 2')).toBe('(!= 1 2)');
  });
});

describe('Parser — errors', () => {
  it('returns null for missing closing paren', () => {
    const scanner = new Scanner('(1 + 2');
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens);
    const result = parser.parse();
    // Either returns null or has errors
    expect(parser.errors.length > 0 || result === null).toBe(true);
  });
});
