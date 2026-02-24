import { Chunk } from './Chunk';
import { OpCode } from './OpCode';
import { VmScanner } from './Scanner';
import { TokenType } from './TokenType';
import type { AnyVmToken, VmErrorToken } from './Token';
import { getLexeme } from './Token';
import type { VmValue } from './Value';

export enum Precedence {
  NONE,
  ASSIGNMENT,   // =
  OR,           // or
  AND,          // and
  EQUALITY,     // == !=
  COMPARISON,   // < > <= >=
  TERM,         // + -
  FACTOR,       // * /
  UNARY,        // ! -
  CALL,         // . ()
  PRIMARY,
}

type ParseFn = (canAssign: boolean) => void;

interface ParseRule {
  prefix: ParseFn | null;
  infix: ParseFn | null;
  precedence: Precedence;
}

const NONE_RULE: ParseRule = { prefix: null, infix: null, precedence: Precedence.NONE };

export class Compiler {
  private scanner!: VmScanner;
  private source: string = '';
  private current!: AnyVmToken;
  private previous!: AnyVmToken;
  private hadError: boolean = false;
  private panicMode: boolean = false;
  private chunk!: Chunk;

  // Arrow-function parse handlers (defined before `rules` so they can be referenced)

  private readonly numberFn: ParseFn = (_canAssign) => {
    const value = parseFloat(getLexeme(this.source, this.previous));
    this.emitConstant(value);
  };

  private readonly groupingFn: ParseFn = (_canAssign) => {
    this.expression();
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.");
  };

  private readonly unaryFn: ParseFn = (_canAssign) => {
    const operatorType = this.previous.type;
    this.parsePrecedence(Precedence.UNARY);
    switch (operatorType) {
      case TokenType.MINUS: this.emitByte(OpCode.OP_NEGATE); break;
      case TokenType.BANG:  this.emitByte(OpCode.OP_NOT);    break;
    }
  };

  private readonly binaryFn: ParseFn = (_canAssign) => {
    const operatorType = this.previous.type;
    const rule = this.getRule(operatorType);
    this.parsePrecedence(rule.precedence + 1);
    switch (operatorType) {
      case TokenType.PLUS:          this.emitByte(OpCode.OP_ADD);                          break;
      case TokenType.MINUS:         this.emitByte(OpCode.OP_SUBTRACT);                     break;
      case TokenType.STAR:          this.emitByte(OpCode.OP_MULTIPLY);                     break;
      case TokenType.SLASH:         this.emitByte(OpCode.OP_DIVIDE);                       break;
      case TokenType.BANG_EQUAL:    this.emitBytes(OpCode.OP_EQUAL, OpCode.OP_NOT);        break;
      case TokenType.EQUAL_EQUAL:   this.emitByte(OpCode.OP_EQUAL);                        break;
      case TokenType.GREATER:       this.emitByte(OpCode.OP_GREATER);                      break;
      case TokenType.GREATER_EQUAL: this.emitBytes(OpCode.OP_LESS, OpCode.OP_NOT);         break;
      case TokenType.LESS:          this.emitByte(OpCode.OP_LESS);                         break;
      case TokenType.LESS_EQUAL:    this.emitBytes(OpCode.OP_GREATER, OpCode.OP_NOT);      break;
    }
  };

  private readonly literalFn: ParseFn = (_canAssign) => {
    switch (this.previous.type) {
      case TokenType.FALSE: this.emitByte(OpCode.OP_FALSE); break;
      case TokenType.NIL:   this.emitByte(OpCode.OP_NIL);   break;
      case TokenType.TRUE:  this.emitByte(OpCode.OP_TRUE);  break;
    }
  };

  private readonly rules: Partial<Record<TokenType, ParseRule>> = {
    [TokenType.LEFT_PAREN]:    { prefix: this.groupingFn, infix: null,          precedence: Precedence.NONE },
    [TokenType.MINUS]:         { prefix: this.unaryFn,    infix: this.binaryFn, precedence: Precedence.TERM },
    [TokenType.PLUS]:          { prefix: null,            infix: this.binaryFn, precedence: Precedence.TERM },
    [TokenType.SLASH]:         { prefix: null,            infix: this.binaryFn, precedence: Precedence.FACTOR },
    [TokenType.STAR]:          { prefix: null,            infix: this.binaryFn, precedence: Precedence.FACTOR },
    [TokenType.BANG]:          { prefix: this.unaryFn,    infix: null,          precedence: Precedence.NONE },
    [TokenType.BANG_EQUAL]:    { prefix: null,            infix: this.binaryFn, precedence: Precedence.EQUALITY },
    [TokenType.EQUAL_EQUAL]:   { prefix: null,            infix: this.binaryFn, precedence: Precedence.EQUALITY },
    [TokenType.GREATER]:       { prefix: null,            infix: this.binaryFn, precedence: Precedence.COMPARISON },
    [TokenType.GREATER_EQUAL]: { prefix: null,            infix: this.binaryFn, precedence: Precedence.COMPARISON },
    [TokenType.LESS]:          { prefix: null,            infix: this.binaryFn, precedence: Precedence.COMPARISON },
    [TokenType.LESS_EQUAL]:    { prefix: null,            infix: this.binaryFn, precedence: Precedence.COMPARISON },
    [TokenType.NUMBER]:        { prefix: this.numberFn,   infix: null,          precedence: Precedence.NONE },
    [TokenType.FALSE]:         { prefix: this.literalFn,  infix: null,          precedence: Precedence.NONE },
    [TokenType.TRUE]:          { prefix: this.literalFn,  infix: null,          precedence: Precedence.NONE },
    [TokenType.NIL]:           { prefix: this.literalFn,  infix: null,          precedence: Precedence.NONE },
  };

  compile(source: string): Chunk | null {
    this.source = source;
    this.scanner = new VmScanner(source);
    this.chunk = new Chunk();
    this.hadError = false;
    this.panicMode = false;
    this.advance();
    this.expression();
    this.consume(TokenType.EOF, 'Expect end of expression.');
    this.emitReturn();
    return this.hadError ? null : this.chunk;
  }

  private advance(): void {
    this.previous = this.current;
    while (true) {
      this.current = this.scanner.scanToken();
      if (this.current.type !== TokenType.ERROR) break;
      this.errorAtCurrent((this.current as VmErrorToken).message);
    }
  }

  private consume(type: TokenType, message: string): void {
    if (this.current.type === type) {
      this.advance();
      return;
    }
    this.errorAtCurrent(message);
  }

  private expression(): void {
    this.parsePrecedence(Precedence.ASSIGNMENT);
  }

  private parsePrecedence(precedence: Precedence): void {
    this.advance();
    const prefixRule = this.getRule(this.previous.type).prefix;
    if (!prefixRule) {
      this.error('Expect expression.');
      return;
    }
    const canAssign = precedence <= Precedence.ASSIGNMENT;
    prefixRule(canAssign);

    while (precedence <= this.getRule(this.current.type).precedence) {
      this.advance();
      const infixRule = this.getRule(this.previous.type).infix!;
      infixRule(canAssign);
    }
  }

  private emitByte(byte: number): void {
    this.chunk.write(byte, this.previous.line);
  }

  private emitBytes(b1: number, b2: number): void {
    this.emitByte(b1);
    this.emitByte(b2);
  }

  private emitReturn(): void {
    this.emitByte(OpCode.OP_RETURN);
  }

  private emitConstant(value: VmValue): void {
    const idx = this.chunk.addConstant(value);
    if (idx > 255) {
      this.error('Too many constants in one chunk.');
      return;
    }
    this.emitBytes(OpCode.OP_CONSTANT, idx);
  }

  private error(message: string): void {
    this.errorAt(this.previous, message);
  }

  private errorAtCurrent(message: string): void {
    this.errorAt(this.current, message);
  }

  private errorAt(token: AnyVmToken, message: string): void {
    if (this.panicMode) return;
    this.panicMode = true;
    console.error(`[line ${token.line}] Error: ${message}`);
    this.hadError = true;
  }

  private getRule(type: TokenType): ParseRule {
    return this.rules[type] ?? NONE_RULE;
  }
}
