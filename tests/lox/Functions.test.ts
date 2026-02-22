import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { Resolver } from '../../src/lox/Resolver';
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
    const resolver = new Resolver(interpreter);
    resolver.resolve(stmts);
    interpreter.interpret(stmts);
  } finally {
    console.log = originalLog;
  }
  return output;
}

describe('Function declarations', () => {
  it('declares and calls a simple function', () => {
    expect(run('fun greet() { print "hi"; } greet();')).toEqual(['hi']);
  });

  it('function with parameters', () => {
    expect(run('fun add(a, b) { print a + b; } add(1, 2);')).toEqual(['3']);
  });

  it('function with return value', () => {
    expect(run('fun double(x) { return x * 2; } print double(5);')).toEqual(['10']);
  });

  it('return nil when no return statement', () => {
    expect(run('fun noop() {} print noop();')).toEqual(['nil']);
  });

  it('bare return returns nil', () => {
    expect(run('fun early() { return; } print early();')).toEqual(['nil']);
  });
});

describe('Recursion', () => {
  it('computes fibonacci recursively', () => {
    const src = `
      fun fib(n) {
        if (n <= 1) return n;
        return fib(n - 2) + fib(n - 1);
      }
      print fib(8);
    `;
    expect(run(src)).toEqual(['21']);
  });
});

describe('Closures', () => {
  it('function captures its defining environment', () => {
    const src = `
      fun makeCounter() {
        var count = 0;
        fun increment() {
          count = count + 1;
          return count;
        }
        return increment;
      }
      var counter = makeCounter();
      print counter();
      print counter();
      print counter();
    `;
    expect(run(src)).toEqual(['1', '2', '3']);
  });
});

describe('Native functions', () => {
  it('clock() returns a number', () => {
    const output = run('print clock();');
    expect(output.length).toBe(1);
    expect(Number(output[0])).toBeGreaterThan(0);
  });
});

describe('Call errors', () => {
  it('throws RuntimeError when calling a non-callable', () => {
    expect(() => run('var x = 1; x();')).toThrow(RuntimeError);
  });

  it('throws RuntimeError on argument count mismatch', () => {
    expect(() => run('fun f(a) {} f(1, 2);')).toThrow(RuntimeError);
  });
});

describe('Function toString', () => {
  it('prints function as <fn name>', () => {
    expect(run('fun foo() {} print foo;')).toEqual(['<fn foo>']);
  });
});
