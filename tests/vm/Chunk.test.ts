import { Chunk } from '../../src/vm/Chunk';
import { OpCode } from '../../src/vm/OpCode';

describe('Chunk', () => {
  it('starts empty', () => {
    const chunk = new Chunk();
    expect(chunk.code.length).toBe(0);
    expect(chunk.constants.length).toBe(0);
  });

  it('writes a byte and tracks the line', () => {
    const chunk = new Chunk();
    chunk.write(OpCode.OP_RETURN, 1);
    expect(chunk.code).toEqual([OpCode.OP_RETURN]);
    expect(chunk.lines).toEqual([1]);
  });

  it('adds a constant and returns its index', () => {
    const chunk = new Chunk();
    const idx = chunk.addConstant(3.14);
    expect(idx).toBe(0);
    expect(chunk.constants[0]).toBe(3.14);
  });

  it('adds multiple constants and tracks indices', () => {
    const chunk = new Chunk();
    chunk.addConstant(1);
    chunk.addConstant(2);
    const idx = chunk.addConstant(3);
    expect(idx).toBe(2);
    expect(chunk.constants).toEqual([1, 2, 3]);
  });

  it('writes OP_CONSTANT with operand', () => {
    const chunk = new Chunk();
    const constIdx = chunk.addConstant(1.2);
    chunk.write(OpCode.OP_CONSTANT, 1);
    chunk.write(constIdx, 1);
    expect(chunk.code).toEqual([OpCode.OP_CONSTANT, 0]);
  });

  it('disassembles OP_RETURN correctly', () => {
    const chunk = new Chunk();
    chunk.write(OpCode.OP_RETURN, 123);
    const output = chunk.disassemble('test');
    expect(output).toContain('OP_RETURN');
    expect(output).toContain('== test ==');
  });

  it('disassembles OP_CONSTANT with value', () => {
    const chunk = new Chunk();
    const idx = chunk.addConstant(42);
    chunk.write(OpCode.OP_CONSTANT, 1);
    chunk.write(idx, 1);
    const output = chunk.disassemble('test');
    expect(output).toContain('OP_CONSTANT');
    expect(output).toContain('42');
  });

  it('tracks same-line instructions with | marker', () => {
    const chunk = new Chunk();
    chunk.write(OpCode.OP_RETURN, 5);
    chunk.write(OpCode.OP_RETURN, 5);
    const output = chunk.disassemble('test');
    expect(output).toContain('|');
  });
});

describe('OpCode enum', () => {
  it('has OP_RETURN defined', () => {
    expect(OpCode.OP_RETURN).toBeDefined();
  });

  it('has OP_CONSTANT defined', () => {
    expect(OpCode.OP_CONSTANT).toBeDefined();
  });

  it('OP_NIL, OP_TRUE, OP_FALSE are defined', () => {
    expect(OpCode.OP_NIL).toBeDefined();
    expect(OpCode.OP_TRUE).toBeDefined();
    expect(OpCode.OP_FALSE).toBeDefined();
  });
});
