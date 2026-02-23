import { Chunk } from './Chunk';
import { OpCode } from './OpCode';
import { VmScanner } from './Scanner';
import { AnyVmToken, getLexeme } from './Token';
import { TokenType } from './TokenType';
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

export class Compiler {
  private scanner!: VmScanner;
  private source!: string;
  private current!: AnyVmToken;
  private previous!: AnyVmToken;
  private hadError: boolean = false;
  private panicMode: boolean = false;
  private chunk!: Chunk;

  private rules!: Partial<Record<TokenType, ParseRule>>;

  compile(source: string): Chunk | null {
    this.source = source;
    this.scanner = new VmScanner(source);
    this.chunk = new Chunk();
    this.hadError = false;
    this.panicMode = false;
    this.initRules();

    this.advance();
    this.expression();
    this.consume(TokenType.EOF, 'Expect end of expression.');
    this.emitReturn();

    return this.hadError ? null : this.chunk;
  }

  private initRules(): void {
    this.rules = {
      [TokenType.LEFT_PAREN]:    { prefix: (c) => this.grouping(c), infix: null,               precedence: Precedence.NONE },
      [TokenType.RIGHT_PAREN]:   { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.LEFT_BRACE]:    { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.RIGHT_BRACE]:   { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.COMMA]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.DOT]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.MINUS]:         { prefix: (c) => this.unary(c),    infix: (c) => this.binary(c), precedence: Precedence.TERM },
      [TokenType.PLUS]:          { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.TERM },
      [TokenType.SEMICOLON]:     { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.SLASH]:         { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.FACTOR },
      [TokenType.STAR]:          { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.FACTOR },
      [TokenType.BANG]:          { prefix: (c) => this.unary(c),    infix: null,               precedence: Precedence.NONE },
      [TokenType.BANG_EQUAL]:    { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.EQUALITY },
      [TokenType.EQUAL]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.EQUAL_EQUAL]:   { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.EQUALITY },
      [TokenType.GREATER]:       { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.COMPARISON },
      [TokenType.GREATER_EQUAL]: { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.COMPARISON },
      [TokenType.LESS]:          { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.COMPARISON },
      [TokenType.LESS_EQUAL]:    { prefix: null,                     infix: (c) => this.binary(c), precedence: Precedence.COMPARISON },
      [TokenType.IDENTIFIER]:    { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.STRING]:        { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.NUMBER]:        { prefix: (c) => this.number(c),   infix: null,               precedence: Precedence.NONE },
      [TokenType.AND]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.CLASS]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.ELSE]:          { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.FALSE]:         { prefix: (c) => this.literal(c),  infix: null,               precedence: Precedence.NONE },
      [TokenType.FOR]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.FUN]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.IF]:            { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.NIL]:           { prefix: (c) => this.literal(c),  infix: null,               precedence: Precedence.NONE },
      [TokenType.OR]:            { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.PRINT]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.RETURN]:        { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.SUPER]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.THIS]:          { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.TRUE]:          { prefix: (c) => this.literal(c),  infix: null,               precedence: Precedence.NONE },
      [TokenType.VAR]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.WHILE]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.ERROR]:         { prefix: null,                     infix: null,               precedence: Precedence.NONE },
      [TokenType.EOF]:           { prefix: null,                     infix: null,               precedence: Precedence.NONE },
    };
  }

  private getRule(type: TokenType): ParseRule {
    return this.rules[type] ?? { prefix: null, infix: null, precedence: Precedence.NONE };
  }

  // ---------- parse functions ----------

  private number(_canAssign: boolean): void {
    const value = parseFloat(getLexeme(this.source, this.previous));
    this.emitConstant(value);
  }

  private grouping(_canAssign: boolean): void {
    this.expression();
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.");
  }

  private unary(_canAssign: boolean): void {
    const operatorType = this.previous.type;
    this.parsePrecedence(Precedence.UNARY);
    switch (operatorType) {
      case TokenType.MINUS: this.emitByte(OpCode.OP_NEGATE); break;
      case TokenType.BANG:  this.emitByte(OpCode.OP_NOT);    break;
    }
  }

  private binary(_canAssign: boolean): void {
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
  }

  private literal(_canAssign: boolean): void {
    switch (this.previous.type) {
      case TokenType.FALSE: this.emitByte(OpCode.OP_FALSE); break;
      case TokenType.NIL:   this.emitByte(OpCode.OP_NIL);   break;
      case TokenType.TRUE:  this.emitByte(OpCode.OP_TRUE);  break;
    }
  }

  // ---------- core parsing ----------

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

  // ---------- token consumption ----------

  private advance(): void {
    this.previous = this.current;
    while (true) {
      this.current = this.scanner.scanToken();
      if (this.current.type !== TokenType.ERROR) break;
      const errToken = this.current as import('./Token').VmErrorToken;
      this.errorAtCurrent(errToken.message);
    }
  }

  private consume(type: TokenType, message: string): void {
    if (this.current.type === type) {
      this.advance();
      return;
    }
    this.errorAtCurrent(message);
  }

  // ---------- emission helpers ----------

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

  // ---------- error handling ----------

  private error(message: string): void {
    this.errorAt(this.previous, message);
  }

  private errorAtCurrent(message: string): void {
    this.errorAt(this.current, message);
  }

  private errorAt(token: AnyVmToken, message: string): void {
    if (this.panicMode) return;
    this.panicMode = true;
    let where = '';
    if (token.type === TokenType.EOF) {
      where = ' at end';
    } else if (token.type !== TokenType.ERROR) {
      where = ` at '${getLexeme(this.source, token)}'`;
    }
    console.error(`[line ${token.line}] Error${where}: ${message}`);
    this.hadError = true;
  }
}
