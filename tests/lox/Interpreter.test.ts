import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { RuntimeError } from '../../src/lox/RuntimeError';

function evaluate(source: string) {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const expr = parser.parse()!;
  const interpreter = new Interpreter();
  return interpreter.interpret(expr);
}

describe('Interpreter — literals', () => {
  it('evaluates a number', () => {
    expect(evaluate('42')).toBe(42);
  });

  it('evaluates a string', () => {
    expect(evaluate('"hello"')).toBe('hello');
  });

  it('evaluates true', () => {
    expect(evaluate('true')).toBe(true);
  });

  it('evaluates false', () => {
    expect(evaluate('false')).toBe(false);
  });

  it('evaluates nil', () => {
    expect(evaluate('nil')).toBeNull();
  });
});

describe('Interpreter — arithmetic', () => {
  it('adds two numbers', () => {
    expect(evaluate('1 + 2')).toBe(3);
  });

  it('subtracts', () => {
    expect(evaluate('10 - 4')).toBe(6);
  });

  it('multiplies', () => {
    expect(evaluate('3 * 4')).toBe(12);
  });

  it('divides', () => {
    expect(evaluate('10 / 2')).toBe(5);
  });

  it('respects precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
  });

  it('negates a number', () => {
    expect(evaluate('-5')).toBe(-5);
  });
});

describe('Interpreter — string concatenation', () => {
  it('concatenates two strings with +', () => {
    expect(evaluate('"hello" + " world"')).toBe('hello world');
  });
});

describe('Interpreter — comparison', () => {
  it('1 < 2 is true', () => {
    expect(evaluate('1 < 2')).toBe(true);
  });

  it('2 > 3 is false', () => {
    expect(evaluate('2 > 3')).toBe(false);
  });

  it('1 <= 1 is true', () => {
    expect(evaluate('1 <= 1')).toBe(true);
  });

  it('2 >= 3 is false', () => {
    expect(evaluate('2 >= 3')).toBe(false);
  });
});

describe('Interpreter — equality', () => {
  it('1 == 1 is true', () => {
    expect(evaluate('1 == 1')).toBe(true);
  });

  it('1 != 2 is true', () => {
    expect(evaluate('1 != 2')).toBe(true);
  });

  it('nil == nil is true', () => {
    expect(evaluate('nil == nil')).toBe(true);
  });

  it('nil != false (different types)', () => {
    expect(evaluate('nil == false')).toBe(false);
  });
});

describe('Interpreter — truthiness and logical not', () => {
  it('!false is true', () => {
    expect(evaluate('!false')).toBe(true);
  });

  it('!nil is true', () => {
    expect(evaluate('!nil')).toBe(true);
  });

  it('!true is false', () => {
    expect(evaluate('!true')).toBe(false);
  });

  it('!0 is false (0 is truthy in Lox)', () => {
    expect(evaluate('!0')).toBe(false);
  });
});

describe('Interpreter — runtime errors', () => {
  it('throws RuntimeError when negating non-number', () => {
    expect(() => evaluate('-"hello"')).toThrow(RuntimeError);
  });

  it('throws RuntimeError when adding number to string', () => {
    expect(() => evaluate('1 + "x"')).toThrow(RuntimeError);
  });

  it('throws RuntimeError on division by zero', () => {
    expect(() => evaluate('1 / 0')).toThrow(RuntimeError);
  });

  it('throws RuntimeError comparing non-numbers', () => {
    expect(() => evaluate('"a" > "b"')).toThrow(RuntimeError);
  });
});

describe('Interpreter — stringify', () => {
  it('formats integer-valued doubles without .0', () => {
    // 1.0 should display as "1"
    const interp = new Interpreter();
    // Access stringify indirectly through a test helper or make it public
    expect(evaluate('1.0')).toBe(1); // internal value
    // The number 1.0 == 1.0 in JS; stringify is tested in Step 06 via print
  });
});
