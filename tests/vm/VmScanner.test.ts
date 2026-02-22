import { VmScanner } from '../../src/vm/Scanner';
import { TokenType } from '../../src/vm/TokenType';
import { getLexeme } from '../../src/vm/Token';

function scanAll(source: string) {
  const scanner = new VmScanner(source);
  const tokens = [];
  let token;
  do {
    token = scanner.scanToken();
    tokens.push(token);
  } while (token.type !== TokenType.EOF);
  return tokens;
}

describe('VmScanner', () => {
  it('scans empty input as EOF', () => {
    const scanner = new VmScanner('');
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.EOF);
  });

  it('scans a number', () => {
    const source = '123';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.NUMBER);
    expect(getLexeme(source, token)).toBe('123');
  });

  it('scans a decimal number', () => {
    const source = '3.14';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(getLexeme(source, token)).toBe('3.14');
  });

  it('scans a string', () => {
    const source = '"hello"';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.STRING);
    expect(getLexeme(source, token)).toBe('"hello"');
  });

  it('produces error token for unterminated string', () => {
    const scanner = new VmScanner('"unterminated');
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.ERROR);
  });

  it('scans all keywords correctly', () => {
    const keywords: [string, TokenType][] = [
      ['and', TokenType.AND], ['class', TokenType.CLASS],
      ['if', TokenType.IF], ['return', TokenType.RETURN],
    ];
    for (const [word, type] of keywords) {
      const scanner = new VmScanner(word);
      expect(scanner.scanToken().type).toBe(type);
    }
  });

  it('scans an identifier', () => {
    const source = 'myVar';
    const scanner = new VmScanner(source);
    const token = scanner.scanToken();
    expect(token.type).toBe(TokenType.IDENTIFIER);
    expect(getLexeme(source, token)).toBe('myVar');
  });

  it('skips line comments', () => {
    const tokens = scanAll('// comment\n123');
    expect(tokens[0].type).toBe(TokenType.NUMBER);
  });

  it('tracks line numbers', () => {
    const scanner = new VmScanner('1\n2');
    scanner.scanToken(); // tok on line 1
    const tok = scanner.scanToken(); // tok on line 2
    expect(tok.line).toBe(2);
  });

  it('scans operators', () => {
    const tokens = scanAll('+ - * / ! != == < <= > >=');
    const types = tokens.slice(0, -1).map(t => t.type); // exclude EOF
    expect(types).toContain(TokenType.PLUS);
    expect(types).toContain(TokenType.BANG_EQUAL);
    expect(types).toContain(TokenType.EQUAL_EQUAL);
    expect(types).toContain(TokenType.LESS_EQUAL);
  });
});
