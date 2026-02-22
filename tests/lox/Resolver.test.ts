import { Scanner } from '../../src/lox/Scanner';
import { Parser } from '../../src/lox/Parser';
import { Interpreter } from '../../src/lox/Interpreter';
import { Resolver } from '../../src/lox/Resolver';
import { RuntimeError } from '../../src/lox/RuntimeError';

function run(source: string): string[] {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();

  if (parser.errors.length > 0) {
    throw new Error(`Parse error: ${parser.errors[0].message}`);
  }

  const interpreter = new Interpreter();
  const resolver = new Resolver(interpreter);
  resolver.resolve(statements);

  if (resolver.errors.length > 0) {
    throw new Error(`Resolve error: ${resolver.errors[0].message}`);
  }

  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    output.push(args.map(arg => String(arg)).join(' '));
  };

  try {
    interpreter.interpret(statements);
  } finally {
    console.log = originalLog;
  }

  return output;
}

describe('Resolver — basic resolution', () => {
  it('resolves a simple variable correctly', () => {
    expect(run('var x = 1; print x;')).toEqual(['1']);
  });

  it('resolves a nested scope variable', () => {
    expect(run('var x = 1; { var x = 2; print x; } print x;')).toEqual([
      '2',
      '1',
    ]);
  });
});

describe('Resolver — closure semantics', () => {
  it('closure captures variable correctly after reassignment', () => {
    // Classic closure test: the closure should see the value
    // at the time of closure creation, not at call time.
    const src = `
      var a = "global";
      {
        fun showA() {
          print a;
        }
        showA();
        var a = "block";
        showA();
      }
    `;
    // Both calls should print "global" — showA captures the global 'a'
    expect(run(src)).toEqual(['global', 'global']);
  });
});

describe('Resolver — error detection', () => {
  it('reports error for variable read in its own initializer', () => {
    expect(() => run('var a = a;')).toThrow();
  });

  it('reports error for return at top level', () => {
    expect(() => run('return 1;')).toThrow();
  });

  it('reports error for duplicate variable in same scope', () => {
    expect(() => run('{ var a = 1; var a = 2; }')).toThrow();
  });
});
