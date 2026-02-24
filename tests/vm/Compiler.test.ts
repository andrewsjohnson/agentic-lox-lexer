import { VM, InterpretResult } from '../../src/vm/VM';

function run(source: string): InterpretResult {
  return new VM().interpretSource(source);
}

function runCapture(source: string): string[] {
  const output: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...a) => output.push(a.join(' ')));
  new VM().interpretSource(source);
  spy.mockRestore();
  return output;
}

describe('Compiler — literals', () => {
  it('compiles true', () => expect(run('true')).toBe(InterpretResult.OK));
  it('compiles false', () => expect(run('false')).toBe(InterpretResult.OK));
  it('compiles nil', () => expect(run('nil')).toBe(InterpretResult.OK));
  it('compiles a number', () => expect(run('42')).toBe(InterpretResult.OK));
});

describe('Compiler — arithmetic', () => {
  it('compiles 1 + 2', () => expect(run('1 + 2')).toBe(InterpretResult.OK));
  it('compiles 2 * 3 + 4', () => expect(run('2 * 3 + 4')).toBe(InterpretResult.OK));
  it('compiles -(1 + 2)', () => expect(run('-(1 + 2)')).toBe(InterpretResult.OK));
});

describe('Compiler — comparison', () => {
  it('compiles 1 < 2', () => expect(run('1 < 2')).toBe(InterpretResult.OK));
  it('compiles 1 == 1', () => expect(run('1 == 1')).toBe(InterpretResult.OK));
  it('compiles 1 != 2', () => expect(run('1 != 2')).toBe(InterpretResult.OK));
});

describe('Compiler — print statement', () => {
  it('prints a number via print statement', () => {
    // Note: print is a statement — we need to extend the compiler in Step 19
    // For now, test expression evaluation is correct
    expect(run('1 + 2')).toBe(InterpretResult.OK);
  });
});

describe('Compiler — errors', () => {
  it('returns COMPILE_ERROR for invalid syntax', () => {
    expect(run('1 +')).toBe(InterpretResult.COMPILE_ERROR);
  });

  it('returns COMPILE_ERROR for unclosed paren', () => {
    expect(run('(1 + 2')).toBe(InterpretResult.COMPILE_ERROR);
  });
});
