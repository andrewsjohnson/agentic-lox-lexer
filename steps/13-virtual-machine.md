# Step 13 — A Virtual Machine

**Book reference**: Chapter 15 — A Virtual Machine
**Builds on**: Step 12 (chunks)

---

## Overview

This step implements the **stack-based virtual machine (VM)** that executes
bytecode. The VM maintains a value stack and an instruction pointer (IP). Each
opcode pops operands off the stack, performs an operation, and pushes the result.

At the end of this step, you can hand-craft a bytecode chunk and execute it —
though we don't have a compiler yet (that comes in Step 15).

---

## What to Implement

### `src/vm/VM.ts`

```typescript
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
```

---

## Tests to Write

Create `tests/vm/VM.test.ts`:

```typescript
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
```

---

## Acceptance Criteria

- [ ] All VM tests pass
- [ ] `InterpretResult.OK` returned for valid bytecode
- [ ] `InterpretResult.RUNTIME_ERROR` returned on type errors (not thrown)
- [ ] Stack underflow throws an internal `Error` (a VM bug, not a Lox error)
- [ ] `OP_PRINT` outputs through `console.log`
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- The VM in this step only handles a subset of opcodes. The rest are stubs that will be wired up in later steps.
- `readByte()` advances `this.ip` and returns the byte at the old position — the standard VM pattern.
- `peek(0)` looks at the top of the stack without popping; `peek(1)` looks one below the top.
- String concatenation in `binaryAdd()` is handled specially because `+` is overloaded for both numbers and strings.
- Commit with message: `feat(vm): implement stack-based virtual machine`
