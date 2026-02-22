import { Chunk } from '../../src/vm/Chunk';
import { OpCode } from '../../src/vm/OpCode';
import { VM, InterpretResult } from '../../src/vm/VM';

function makeChunk(build: (chunk: Chunk) => void): Chunk {
  const chunk = new Chunk();
  build(chunk);
  chunk.write(OpCode.OP_RETURN, 1);
  return chunk;
}

describe('VM — basic execution', () => {
  it('returns OK for an empty program (just RETURN)', () => {
    const chunk = new Chunk();
    chunk.write(OpCode.OP_RETURN, 1);
    const vm = new VM();
    expect(vm.interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('pushes and pops a constant', () => {
    const chunk = makeChunk(c => {
      const idx = c.addConstant(1.2);
      c.write(OpCode.OP_CONSTANT, 1);
      c.write(idx, 1);
      c.write(OpCode.OP_POP, 1);
    });
    const vm = new VM();
    expect(vm.interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('pushes nil, true, false', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_NIL, 1);
      c.write(OpCode.OP_POP, 1);
      c.write(OpCode.OP_TRUE, 1);
      c.write(OpCode.OP_POP, 1);
      c.write(OpCode.OP_FALSE, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });
});

describe('VM — arithmetic', () => {
  it('adds two constants', () => {
    // 1 + 2 = 3 — just run without runtime error
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(1), 1);
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(2), 1);
      c.write(OpCode.OP_ADD, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('subtracts', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(5), 1);
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(3), 1);
      c.write(OpCode.OP_SUBTRACT, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('negates a number', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(5), 1);
      c.write(OpCode.OP_NEGATE, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('returns runtime error when negating non-number', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_TRUE, 1);
      c.write(OpCode.OP_NEGATE, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.RUNTIME_ERROR);
  });
});

describe('VM — comparison and equality', () => {
  it('evaluates greater-than', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(3), 1);
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(1), 1);
      c.write(OpCode.OP_GREATER, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });

  it('evaluates equality', () => {
    const chunk = makeChunk(c => {
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(1), 1);
      c.write(OpCode.OP_CONSTANT, 1); c.write(c.addConstant(1), 1);
      c.write(OpCode.OP_EQUAL, 1);
      c.write(OpCode.OP_POP, 1);
    });
    expect(new VM().interpret(chunk)).toBe(InterpretResult.OK);
  });
});

describe('VM — print', () => {
  it('prints a value', () => {
    const output: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));

    const chunk = new Chunk();
    chunk.write(OpCode.OP_CONSTANT, 1); chunk.write(chunk.addConstant(42), 1);
    chunk.write(OpCode.OP_PRINT, 1);
    chunk.write(OpCode.OP_RETURN, 1);
    new VM().interpret(chunk);
    spy.mockRestore();

    expect(output).toEqual(['42']);
  });
});
