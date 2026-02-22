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
    if (parser.errors.length > 0) throw parser.errors[0];
    const interpreter = new Interpreter();
    const resolver = new Resolver(interpreter);
    resolver.resolve(stmts);
    if (resolver.errors.length > 0) throw resolver.errors[0];
    interpreter.interpret(stmts);
  } finally {
    console.log = originalLog;
  }
  return output;
}

describe('Class declarations and instances', () => {
  it('creates an instance', () => {
    expect(run('class Foo {} var f = Foo(); print f;')).toEqual(['Foo instance']);
  });

  it('prints a class itself', () => {
    expect(run('class Foo {} print Foo;')).toEqual(['Foo']);
  });

  it('sets and gets a field', () => {
    expect(run('class Foo {} var f = Foo(); f.x = 42; print f.x;')).toEqual(['42']);
  });

  it('throws RuntimeError on accessing undefined property', () => {
    expect(() => run('class Foo {} var f = Foo(); print f.x;')).toThrow(RuntimeError);
  });
});

describe('Methods', () => {
  it('calls a method', () => {
    expect(run(`
      class Greeter {
        greet() {
          print "hello";
        }
      }
      Greeter().greet();
    `)).toEqual(['hello']);
  });

  it('this refers to the instance', () => {
    expect(run(`
      class Counter {
        init() { this.count = 0; }
        increment() { this.count = this.count + 1; }
        value() { return this.count; }
      }
      var c = Counter();
      c.increment();
      c.increment();
      print c.value();
    `)).toEqual(['2']);
  });
});

describe('Initializer (init)', () => {
  it('init is called on construction', () => {
    expect(run(`
      class Point {
        init(x, y) {
          this.x = x;
          this.y = y;
        }
      }
      var p = Point(3, 4);
      print p.x;
      print p.y;
    `)).toEqual(['3', '4']);
  });

  it('init returns the instance', () => {
    expect(run(`
      class Foo {
        init() { this.x = 1; }
      }
      print Foo().x;
    `)).toEqual(['1']);
  });
});

describe('Methods as closures', () => {
  it('method stored in variable retains this binding', () => {
    expect(run(`
      class Adder {
        init(n) { this.n = n; }
        add(x) { return this.n + x; }
      }
      var a = Adder(10);
      var addFn = a.add;
      print addFn(5);
    `)).toEqual(['15']);
  });
});

describe('Resolver errors for classes', () => {
  it('this outside class is a compile-time error', () => {
    expect(() => run('print this;')).toThrow();
  });

  it('return with value in init is a compile-time error', () => {
    expect(() => run('class Foo { init() { return 1; } }')).toThrow();
  });
});
