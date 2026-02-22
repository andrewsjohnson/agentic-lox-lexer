import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { Resolver } from '../../src/lox/Resolver';

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
    const resolver = new Resolver(interpreter);
    resolver.resolve(stmts);
    interpreter.interpret(stmts);
  } finally {
    console.log = originalLog;
  }
  return output;
}

describe('if/else', () => {
  it('executes then branch when condition is true', () => {
    expect(run('if (true) print "yes";')).toEqual(['yes']);
  });

  it('skips then branch when condition is false', () => {
    expect(run('if (false) print "yes";')).toEqual([]);
  });

  it('executes else branch when condition is false', () => {
    expect(run('if (false) print "yes"; else print "no";')).toEqual(['no']);
  });

  it('if with block', () => {
    expect(run('if (true) { print 1; print 2; }')).toEqual(['1', '2']);
  });

  it('dangling else binds to nearest if', () => {
    // if (true) if (false) print "a"; else print "b";
    // Should print "b" (else binds to inner if)
    expect(run('if (true) if (false) print "a"; else print "b";')).toEqual(['b']);
  });
});

describe('while', () => {
  it('executes body while condition is true', () => {
    expect(run('var i = 0; while (i < 3) { print i; i = i + 1; }')).toEqual(['0', '1', '2']);
  });

  it('does not execute if condition is initially false', () => {
    expect(run('while (false) print "x";')).toEqual([]);
  });
});

describe('for loop', () => {
  it('counts from 0 to 2', () => {
    expect(run('for (var i = 0; i < 3; i = i + 1) print i;')).toEqual(['0', '1', '2']);
  });

  it('supports for with no initializer', () => {
    expect(run('var i = 0; for (; i < 2; i = i + 1) print i;')).toEqual(['0', '1']);
  });

  it('supports for with no increment', () => {
    expect(run('for (var i = 0; i < 2;) { print i; i = i + 1; }')).toEqual(['0', '1']);
  });

  it('for loop body variable is scoped to block', () => {
    // The loop variable i should not be accessible after the loop
    // (because for desugars to a block)
    expect(run('for (var i = 0; i < 1; i = i + 1) print i;')).toEqual(['0']);
  });
});

describe('logical operators', () => {
  it('and returns right value when left is truthy', () => {
    expect(run('print (1 and 2);')).toEqual(['2']);
  });

  it('and returns left value when left is falsy (short-circuit)', () => {
    expect(run('print (false and "never");')).toEqual(['false']);
  });

  it('or returns left value when left is truthy (short-circuit)', () => {
    expect(run('print ("yes" or "no");')).toEqual(['yes']);
  });

  it('or returns right value when left is falsy', () => {
    expect(run('print (false or "fallback");')).toEqual(['fallback']);
  });

  it('nil is falsy in and', () => {
    expect(run('print (nil and "x");')).toEqual(['nil']);
  });
});
