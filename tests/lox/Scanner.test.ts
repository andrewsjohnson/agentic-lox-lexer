import { Scanner } from '../../src/lox/Scanner';
import { TokenType } from '../../src/lox/TokenType';

describe('Scanner', () => {
  describe('single-character tokens', () => {
    it('scans left and right parens', () => {
      const scanner = new Scanner('()');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[1].type).toBe(TokenType.RIGHT_PAREN);
    });

    it('scans braces', () => {
      const scanner = new Scanner('{}');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.LEFT_BRACE);
      expect(tokens[1].type).toBe(TokenType.RIGHT_BRACE);
    });

    it('scans arithmetic operators', () => {
      const scanner = new Scanner('+-*/');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.STAR);
      expect(tokens[3].type).toBe(TokenType.SLASH);
    });

    it('scans dot, comma, semicolon', () => {
      const scanner = new Scanner('.,;');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.DOT);
      expect(tokens[1].type).toBe(TokenType.COMMA);
      expect(tokens[2].type).toBe(TokenType.SEMICOLON);
    });
  });

  describe('one-or-two character tokens', () => {
    it('scans ! and !=', () => {
      const scanner = new Scanner('! !=');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.BANG);
      expect(tokens[1].type).toBe(TokenType.BANG_EQUAL);
    });

    it('scans = and ==', () => {
      const scanner = new Scanner('= ==');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.EQUAL);
      expect(tokens[1].type).toBe(TokenType.EQUAL_EQUAL);
    });

    it('scans < and <=', () => {
      const scanner = new Scanner('< <=');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.LESS);
      expect(tokens[1].type).toBe(TokenType.LESS_EQUAL);
    });

    it('scans > and >=', () => {
      const scanner = new Scanner('> >=');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.GREATER);
      expect(tokens[1].type).toBe(TokenType.GREATER_EQUAL);
    });
  });

  describe('literals', () => {
    it('scans a string literal', () => {
      const scanner = new Scanner('"hello"');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].literal).toBe('hello');
    });

    it('scans a multi-line string', () => {
      const scanner = new Scanner('"line1\nline2"');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].literal).toBe('line1\nline2');
      // line count should advance past the newline in the string
      expect(tokens[1].line).toBe(2);
    });

    it('reports error for unterminated string', () => {
      const scanner = new Scanner('"unterminated');
      scanner.scanTokens();
      expect(scanner.errors.length).toBeGreaterThan(0);
    });

    it('scans integer number', () => {
      const scanner = new Scanner('123');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(123);
    });

    it('scans decimal number', () => {
      const scanner = new Scanner('45.67');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(45.67);
    });
  });

  describe('keywords', () => {
    it('recognizes all keywords', () => {
      const keywords = [
        'and', 'class', 'else', 'false', 'for', 'fun', 'if',
        'nil', 'or', 'print', 'return', 'super', 'this', 'true',
        'var', 'while',
      ];
      const expectedTypes: TokenType[] = [
        TokenType.AND, TokenType.CLASS, TokenType.ELSE, TokenType.FALSE,
        TokenType.FOR, TokenType.FUN, TokenType.IF, TokenType.NIL,
        TokenType.OR, TokenType.PRINT, TokenType.RETURN, TokenType.SUPER,
        TokenType.THIS, TokenType.TRUE, TokenType.VAR, TokenType.WHILE,
      ];

      keywords.forEach((kw, i) => {
        const scanner = new Scanner(kw);
        const tokens = scanner.scanTokens();
        expect(tokens[0].type).toBe(expectedTypes[i]);
      });
    });

    it('treats unknown words as identifiers', () => {
      const scanner = new Scanner('foobar');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].lexeme).toBe('foobar');
    });
  });

  describe('comments', () => {
    it('ignores line comments', () => {
      const scanner = new Scanner('// this is a comment\n1');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  describe('whitespace', () => {
    it('increments line number on newline', () => {
      const scanner = new Scanner('1\n2');
      const tokens = scanner.scanTokens();
      expect(tokens[0].line).toBe(1);
      expect(tokens[1].line).toBe(2);
    });

    it('skips spaces and tabs', () => {
      const scanner = new Scanner('  1  ');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  describe('EOF', () => {
    it('always appends EOF token', () => {
      const scanner = new Scanner('');
      const tokens = scanner.scanTokens();
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
  });

  describe('complex expressions', () => {
    it('scans a full expression', () => {
      // "1 + 2 * (3 - 4)" => NUMBER PLUS NUMBER STAR LEFT_PAREN NUMBER MINUS NUMBER RIGHT_PAREN EOF
      const scanner = new Scanner('1 + 2 * (3 - 4)');
      const tokens = scanner.scanTokens();
      const types = tokens.map(t => t.type);
      expect(types).toEqual([
        TokenType.NUMBER,
        TokenType.PLUS,
        TokenType.NUMBER,
        TokenType.STAR,
        TokenType.LEFT_PAREN,
        TokenType.NUMBER,
        TokenType.MINUS,
        TokenType.NUMBER,
        TokenType.RIGHT_PAREN,
        TokenType.EOF,
      ]);
    });

    it('scans a print statement', () => {
      const scanner = new Scanner('print "hello";');
      const tokens = scanner.scanTokens();
      expect(tokens[0].type).toBe(TokenType.PRINT);
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].literal).toBe('hello');
      expect(tokens[2].type).toBe(TokenType.SEMICOLON);
      expect(tokens[3].type).toBe(TokenType.EOF);
    });
  });
});
