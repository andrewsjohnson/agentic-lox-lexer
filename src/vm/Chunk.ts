import { OpCode } from './OpCode';
import type { VmValue } from './Value';

export class Chunk {
  readonly code: number[] = [];          // bytecode (opcodes + operands)
  readonly constants: VmValue[] = [];    // constant pool
  readonly lines: number[] = [];         // parallel array: source line per byte

  write(byte: number, line: number): void {
    this.code.push(byte);
    this.lines.push(line);
  }

  addConstant(value: VmValue): number {
    this.constants.push(value);
    return this.constants.length - 1;
  }

  // Disassemble the chunk for debugging
  disassemble(name: string): string {
    const lines: string[] = [`== ${name} ==`];
    let offset = 0;
    while (offset < this.code.length) {
      const [line, newOffset] = this.disassembleInstruction(offset);
      lines.push(line);
      offset = newOffset;
    }
    return lines.join('\n');
  }

  disassembleInstruction(offset: number): [string, number] {
    const prefix = String(offset).padStart(4, '0');
    const lineInfo = offset > 0 && this.lines[offset] === this.lines[offset - 1]
      ? '   |'
      : String(this.lines[offset]).padStart(4, ' ');

    const instruction = this.code[offset] as OpCode;

    switch (instruction) {
      case OpCode.OP_CONSTANT: {
        const constIdx = this.code[offset + 1];
        const value = this.constants[constIdx];
        return [`${prefix} ${lineInfo} OP_CONSTANT ${constIdx} '${value}'`, offset + 2];
      }
      case OpCode.OP_NIL:
        return [`${prefix} ${lineInfo} OP_NIL`, offset + 1];
      case OpCode.OP_TRUE:
        return [`${prefix} ${lineInfo} OP_TRUE`, offset + 1];
      case OpCode.OP_FALSE:
        return [`${prefix} ${lineInfo} OP_FALSE`, offset + 1];
      case OpCode.OP_RETURN:
        return [`${prefix} ${lineInfo} OP_RETURN`, offset + 1];
      // Add more cases as opcodes are used in later steps
      default:
        return [`${prefix} ${lineInfo} Unknown opcode ${instruction}`, offset + 1];
    }
  }
}
