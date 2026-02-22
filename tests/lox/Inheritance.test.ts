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

describe('Inheritance basics', () => {
  it('subclass inherits method from superclass', () => {
    expect(run(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {}
      Dog().speak();
    `)).toEqual(['...']);
  });

  it('subclass overrides method', () => {
    expect(run(`
      class Animal {
        speak() { print "..."; }
      }
      class Dog < Animal {
        speak() { print "Woof!"; }
      }
      Dog().speak();
    `)).toEqual(['Woof!']);
  });

  it('subclass uses its own fields and inherited methods', () => {
    expect(run(`
      class Animal {
        init(name) { this.name = name; }
        describe() { print this.name; }
      }
      class Dog < Animal {}
      var d = Dog("Rex");
      d.describe();
    `)).toEqual(['Rex']);
  });
});

describe('super', () => {
  it('calls superclass method via super', () => {
    expect(run(`
      class A {
        method() { print "A"; }
      }
      class B < A {
        method() {
          super.method();
          print "B";
        }
      }
      B().method();
    `)).toEqual(['A', 'B']);
  });

  it('super method is bound to current instance', () => {
    expect(run(`
      class Base {
        whoAmI() { print this.name; }
      }
      class Child < Base {
        init(name) { this.name = name; }
        greet() { super.whoAmI(); }
      }
      Child("Charlie").greet();
    `)).toEqual(['Charlie']);
  });

  it('multi-level super call', () => {
    expect(run(`
      class A {
        method() { print "A"; }
      }
      class B < A {
        method() { super.method(); print "B"; }
      }
      class C < B {
        method() { super.method(); print "C"; }
      }
      C().method();
    `)).toEqual(['A', 'B', 'C']);
  });
});

describe('Inheritance resolver errors', () => {
  it('class cannot inherit from itself', () => {
    expect(() => run('class Foo < Foo {}')).toThrow();
  });

  it('super outside class is an error', () => {
    expect(() => run('super.method();')).toThrow();
  });

  it('super in class with no superclass is an error', () => {
    expect(() => run(`
      class Foo {
        method() { super.something(); }
      }
    `)).toThrow();
  });

  it('inheriting from a non-class is a runtime error', () => {
    expect(() => run('var x = 1; class Foo < x {}')).toThrow(RuntimeError);
  });
});

describe('Complete inheritance program', () => {
  it('runs the classic doughnut/boston creme example', () => {
    const src = `
      class Doughnut {
        cook() {
          print "Fry until golden brown.";
        }
      }

      class BostonCream < Doughnut {
        cook() {
          super.cook();
          print "Pipe full of custard and coat with chocolate.";
        }
      }

      BostonCream().cook();
    `;
    expect(run(src)).toEqual([
      'Fry until golden brown.',
      'Pipe full of custard and coat with chocolate.',
    ]);
  });
});
