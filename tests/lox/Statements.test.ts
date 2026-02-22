import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { RuntimeError } from '../../src/lox/RuntimeError';

function run(source: string): string[] {
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
