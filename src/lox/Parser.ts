import { Token } from './Token';
import { TokenType } from './TokenType';
import { Expr, LoxLiteral } from './Expr';
import { Stmt, StmtVisitor } from './Stmt';

export class ParseError extends Error {
  constructor(
    public readonly token: Token,
    message: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private current = 0;
  public readonly errors: ParseError[] = [];

  constructor(private readonly tokens: Token[]) {}

  parse(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      const decl = this.declaration();
      if (decl !== null) statements.push(decl);
    }
    return statements;
  }

  private declaration(): Stmt | null {
    try {
      if (this.match(TokenType.CLASS)) return this.classDeclaration();
      if (this.match(TokenType.FUN)) return this.funDeclaration();
      if (this.match(TokenType.VAR)) return this.varDeclaration();
      return this.statement();
    } catch (e) {
      if (e instanceof ParseError) {
        this.synchronize();
        return null;
      }
      throw e;
    }
  }

  private classDeclaration(): Stmt {
    const name = this.consume(TokenType.IDENTIFIER, "Expect class name.");
    this.consume(TokenType.LEFT_BRACE, "Expect '{' before class body.");
    const methods: Stmt.Function[] = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      methods.push(this.function_('method'));
    }
    this.consume(TokenType.RIGHT_BRACE, "Expect '}' after class body.");
    return new Stmt.Class(name, methods);
  }

  private funDeclaration(): Stmt {
    return this.function_('function');
  }

  private function_(kind: string): Stmt.Function {
    const name = this.consume(TokenType.IDENTIFIER, `Expect ${kind} name.`);
    this.consume(TokenType.LEFT_PAREN, `Expect '(' after ${kind} name.`);
    const params: Token[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        params.push(this.consume(TokenType.IDENTIFIER, "Expect parameter name."));
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after parameters.");
    this.consume(TokenType.LEFT_BRACE, `Expect '{' before ${kind} body.`);
    const body = this.block();
    return new Stmt.Function(name, params, body);
  }

  private varDeclaration(): Stmt {
    const name = this.consume(TokenType.IDENTIFIER, "Expect variable name.");
    const initializer: Expr | null = this.match(TokenType.EQUAL)
      ? this.expression()
      : null;
    this.consume(TokenType.SEMICOLON, "Expect ';' after variable declaration.");
    return new Stmt.Var(name, initializer);
  }

  private statement(): Stmt {
    if (this.match(TokenType.PRINT)) return this.printStatement();
    if (this.match(TokenType.IF)) return this.ifStatement();
    if (this.match(TokenType.WHILE)) return this.whileStatement();
    if (this.match(TokenType.FOR)) return this.forStatement();
    if (this.match(TokenType.RETURN)) return this.returnStatement();
    if (this.match(TokenType.LEFT_BRACE)) return new Stmt.Block(this.block());
    return this.expressionStatement();
  }

  private printStatement(): Stmt {
    const value = this.expression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after value.");
    return new Stmt.Print(value);
  }

  private ifStatement(): Stmt {
    this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'if'.");
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after if condition.");

    const thenBranch = this.statement();
    const elseBranch = this.match(TokenType.ELSE) ? this.statement() : null;

    return new Stmt.If(condition, thenBranch, elseBranch);
  }

  private whileStatement(): Stmt {
    this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'while'.");
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after while condition.");
    const body = this.statement();

    return new Stmt.While(condition, body);
  }

  private forStatement(): Stmt {
    this.consume(TokenType.LEFT_PAREN, "Expect '(' after 'for'.");

    // Parse initializer
    let initializer: Stmt | null;
    if (this.match(TokenType.SEMICOLON)) {
      initializer = null;
    } else if (this.match(TokenType.VAR)) {
      initializer = this.varDeclaration();
    } else {
      initializer = this.expressionStatement();
    }

    // Parse condition
    let condition: Expr = new Expr.Literal(true);
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.expression();
    }
    this.consume(TokenType.SEMICOLON, "Expect ';' after loop condition.");

    // Parse increment
    let increment: Expr | null = null;
    if (!this.check(TokenType.RIGHT_PAREN)) {
      increment = this.expression();
    }
    this.consume(TokenType.RIGHT_PAREN, "Expect ')' after for clauses.");

    // Desugar to while loop
    let body = this.statement();

    // If there's an increment, wrap the body with it
    if (increment !== null) {
      body = new Stmt.Block([body, new Stmt.Expression(increment)]);
    }

    // Create the while loop
    body = new Stmt.While(condition, body);

    // If there's an initializer, wrap everything in a block
    if (initializer !== null) {
      body = new Stmt.Block([initializer, body]);
    }

    return body;
  }

  private returnStatement(): Stmt {
    const keyword = this.previous();
    const value: Expr | null = this.check(TokenType.SEMICOLON) ? null : this.expression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after return value.");
    return new Stmt.Return(keyword, value);
  }

  private block(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      const decl = this.declaration();
      if (decl !== null) statements.push(decl);
    }
    this.consume(TokenType.RIGHT_BRACE, "Expect '}' after block.");
    return statements;
  }

  private expressionStatement(): Stmt {
    const expr = this.expression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after expression.");
    return new Stmt.Expression(expr);
  }

  private expression(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const expr = this.or();

    if (this.match(TokenType.EQUAL)) {
      const equals = this.previous();
      const value = this.assignment();

      if (expr instanceof Expr.Variable) {
        return new Expr.Assign(expr.name, value);
      }

      if (expr instanceof Expr.Get) {
        return new Expr.Set(expr.object, expr.name, value);
      }

      this.error(equals, 'Invalid assignment target.');
    }

    return expr;
  }

  private or(): Expr {
    let expr = this.and();

    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.and();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  }

  private and(): Expr {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.equality();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr = this.term();

    while (
      this.match(
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL,
      )
    ) {
      const operator = this.previous();
      const right = this.term();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private term(): Expr {
    let expr = this.factor();

    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator = this.previous();
      const right = this.factor();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private factor(): Expr {
    let expr = this.unary();

    while (this.match(TokenType.SLASH, TokenType.STAR)) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.unary();
      return new Expr.Unary(operator, right);
    }

    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        const paren = this.previous();
        const args: Expr[] = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RIGHT_PAREN, "Expect ')' after arguments.");
        expr = new Expr.Call(expr, paren, args);
      } else if (this.match(TokenType.DOT)) {
        const name = this.consume(TokenType.IDENTIFIER, "Expect property name after '.'.");
        expr = new Expr.Get(expr, name);
      } else {
        break;
      }
    }

    return expr;
  }

  private primary(): Expr {
    if (this.match(TokenType.FALSE)) return new Expr.Literal(false);
    if (this.match(TokenType.TRUE)) return new Expr.Literal(true);
    if (this.match(TokenType.NIL)) return new Expr.Literal(null);

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return new Expr.Literal(this.previous().literal as LoxLiteral);
    }

    if (this.match(TokenType.THIS)) return new Expr.This(this.previous());

    if (this.match(TokenType.IDENTIFIER)) {
      return new Expr.Variable(this.previous());
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.");
      return new Expr.Grouping(expr);
    }

    throw this.error(this.peek(), 'Expect expression.');
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): ParseError {
    const err = new ParseError(token, message);
    this.errors.push(err);
    return err;
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;

      switch (this.peek().type) {
        case TokenType.CLASS:
        case TokenType.FUN:
        case TokenType.VAR:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.PRINT:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }
}
