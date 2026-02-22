import { Chunk } from './Chunk';
import { OpCode } from './OpCode';
import type { VmValue } from './Value';
import { printValue, valuesEqual } from './Value';

export enum InterpretResult {
  OK,
  COMPILE_ERROR,
  RUNTIME_ERROR,
}

export class VM {
  private chunk!: Chunk;
  private ip: number = 0;           // instruction pointer
  private stack: VmValue[] = [];    // value stack

  interpret(chunk: Chunk): InterpretResult {
    this.chunk = chunk;
    this.ip = 0;
    this.stack = [];
    return this.run();
  }

  private run(): InterpretResult {
    while (true) {
      const instruction = this.readByte() as OpCode;

      switch (instruction) {
        case OpCode.OP_CONSTANT: {
          const constant = this.readConstant();
          this.push(constant);
          break;
        }
        case OpCode.OP_NIL:    this.push(null);  break;
        case OpCode.OP_TRUE:   this.push(true);  break;
        case OpCode.OP_FALSE:  this.push(false); break;

        case OpCode.OP_POP: this.pop(); break;

        case OpCode.OP_NEGATE: {
          if (typeof this.peek(0) !== 'number') {
            return this.runtimeError('Operand must be a number.');
          }
          this.push(-(this.pop() as number));
          break;
        }

        case OpCode.OP_NOT:
          this.push(!this.isTruthy(this.pop()));
          break;

        case OpCode.OP_EQUAL: {
          const b = this.pop();
          const a = this.pop();
          this.push(valuesEqual(a, b));
          break;
        }
        case OpCode.OP_GREATER:
          if (!this.binaryOp((a, b) => a > b, 'number')) return InterpretResult.RUNTIME_ERROR;
          break;
        case OpCode.OP_LESS:
          if (!this.binaryOp((a, b) => a < b, 'number')) return InterpretResult.RUNTIME_ERROR;
          break;

        case OpCode.OP_ADD:
          if (!this.binaryAdd()) return InterpretResult.RUNTIME_ERROR;
          break;
        case OpCode.OP_SUBTRACT:
          if (!this.binaryOp((a, b) => a - b, 'number')) return InterpretResult.RUNTIME_ERROR;
          break;
        case OpCode.OP_MULTIPLY:
          if (!this.binaryOp((a, b) => a * b, 'number')) return InterpretResult.RUNTIME_ERROR;
          break;
        case OpCode.OP_DIVIDE:
          if (!this.binaryOp((a, b) => a / b, 'number')) return InterpretResult.RUNTIME_ERROR;
          break;

        case OpCode.OP_PRINT: {
          const val = this.pop();
          console.log(printValue(val));
          break;
        }

        case OpCode.OP_RETURN:
          return InterpretResult.OK;

        default:
          return this.runtimeError(`Unknown opcode: ${instruction}`);
      }
    }
  }

  private readByte(): number {
    return this.chunk.code[this.ip++];
  }

  private readConstant(): VmValue {
    return this.chunk.constants[this.readByte()];
  }

  private push(value: VmValue): void {
    this.stack.push(value);
  }

  private pop(): VmValue {
    const val = this.stack.pop();
    if (val === undefined) throw new Error('VM stack underflow');
    return val;
  }

  private peek(distance: number): VmValue {
    return this.stack[this.stack.length - 1 - distance];
  }

  private isTruthy(value: VmValue): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return value;
    return true;
  }

  private binaryOp(
    op: (a: number, b: number) => VmValue,
    _type: 'number',
  ): boolean {
    if (typeof this.peek(0) !== 'number' || typeof this.peek(1) !== 'number') {
      this.runtimeError('Operands must be numbers.');
      return false;
    }
    const b = this.pop() as number;
    const a = this.pop() as number;
    this.push(op(a, b));
    return true;
  }

  private binaryAdd(): boolean {
    const b = this.peek(0);
    const a = this.peek(1);
    if (typeof a === 'string' && typeof b === 'string') {
      this.pop(); this.pop();
      this.push(a + b);
      return true;
    }
    if (typeof a === 'number' && typeof b === 'number') {
      this.pop(); this.pop();
      this.push(a + b);
      return true;
    }
    this.runtimeError('Operands must be two numbers or two strings.');
    return false;
  }

  private runtimeError(message: string): InterpretResult {
    const line = this.chunk.lines[this.ip - 1];
    console.error(`[line ${line}] RuntimeError: ${message}`);
    return InterpretResult.RUNTIME_ERROR;
  }
}
