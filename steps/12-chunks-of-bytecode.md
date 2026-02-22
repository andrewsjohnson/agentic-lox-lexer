# Step 12 — Chunks of Bytecode

**Book reference**: Chapter 14 — Chunks of Bytecode
**Builds on**: Step 11 (complete tree-walk interpreter)

---

## Overview

Part III builds a second, faster implementation of Lox: a **bytecode virtual
machine** (clox in the book, `vm/` in this repo). Instead of walking an AST,
we compile Lox source code to a sequence of bytecode instructions and execute
them on a stack-based VM.

This first step defines the **bytecode format**: opcodes and the `Chunk` data
structure that holds a sequence of instructions, constants, and line information.

---

## What to Implement

### `src/vm/OpCode.ts`

Define an enum of all bytecode instruction opcodes:

```typescript
export enum OpCode {
  // Literals / constants
  OP_CONSTANT,       // push a constant from the constant pool
  OP_NIL,            // push nil
  OP_TRUE,           // push true
  OP_FALSE,          // push false

  // Arithmetic
  OP_ADD,
  OP_SUBTRACT,
  OP_MULTIPLY,
  OP_DIVIDE,
  OP_NEGATE,

  // Comparison & equality
  OP_EQUAL,
  OP_GREATER,
  OP_LESS,
  OP_NOT,

  // Output
  OP_PRINT,

  // Control
  OP_JUMP,
  OP_JUMP_IF_FALSE,
  OP_LOOP,

  // Variables
  OP_POP,
  OP_DEFINE_GLOBAL,
  OP_GET_GLOBAL,
  OP_SET_GLOBAL,
  OP_GET_LOCAL,
  OP_SET_LOCAL,
  OP_GET_UPVALUE,
  OP_SET_UPVALUE,
  OP_CLOSE_UPVALUE,

  // Functions
  OP_CALL,
  OP_CLOSURE,
  OP_RETURN,

  // Classes
  OP_CLASS,
  OP_GET_PROPERTY,
  OP_SET_PROPERTY,
  OP_METHOD,
  OP_INVOKE,
  OP_INHERIT,
  OP_GET_SUPER,
  OP_SUPER_INVOKE,
}
```

### `src/vm/Value.ts`

Define the value type for the VM. In the book (C), values are tagged unions.
In TypeScript, we use a discriminated union or a plain type alias:

```typescript
export type VmValue = null | boolean | number | string | VmObject;

// VmObject covers heap-allocated values (strings, functions, etc.)
// We'll expand this in later steps. For now it's a placeholder.
export interface VmObject {
  readonly type: 'string' | 'function' | 'closure' | 'upvalue'
                | 'class' | 'instance' | 'bound_method' | 'native';
}

export function printValue(value: VmValue): string {
  if (value === null) return 'nil';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'string') return value;
  return '[object]';
}

export function valuesEqual(a: VmValue, b: VmValue): boolean {
  if (typeof a !== typeof b && !(a === null || b === null)) return false;
  return a === b;
}
```

### `src/vm/Chunk.ts`

```typescript
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
```

---

## Tests to Write

Create `tests/vm/Chunk.test.ts`:

```typescript
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
```

---

## Acceptance Criteria

- [ ] All chunk tests pass
- [ ] `Chunk.write()` correctly records bytecode and line numbers
- [ ] `Chunk.addConstant()` returns the correct index
- [ ] `Chunk.disassemble()` produces readable output for at least OP_RETURN and OP_CONSTANT
- [ ] All opcodes listed are present in the `OpCode` enum
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Keep `Chunk.code` as `number[]` (not `Uint8Array`) for easier manipulation in TypeScript; we can optimize to `Uint8Array` later.
- The `lines` array is parallel to `code` — every byte has a corresponding line number. This is simple but memory-inefficient; the book uses run-length encoding. The simple parallel array is fine for this step.
- The disassembler is a debugging tool — don't worry about making it perfect now. It will be updated as more opcodes are added.
- Commit with message: `feat(vm): add Chunk, OpCode definitions, and disassembler`
