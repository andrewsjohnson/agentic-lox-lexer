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
