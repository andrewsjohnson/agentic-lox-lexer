import * as fs from 'fs';
import * as readline from 'readline';
import { Scanner } from './Scanner';
import { Parser } from './Parser';
import { Interpreter } from './Interpreter';
import { Resolver } from './Resolver';
import { RuntimeError } from './RuntimeError';

const interpreter = new Interpreter();
let hadError = false;
let hadRuntimeError = false;

function run(source: string): void {
  const scanner = new Scanner(source);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens);
  const statements = parser.parse();

  if (parser.errors.length > 0) {
    for (const err of parser.errors) {
      console.error(`[line ${err.token.line}] Error: ${err.message}`);
    }
    hadError = true;
    return;
  }

  const resolver = new Resolver(interpreter);
  resolver.resolve(statements);

  if (resolver.errors.length > 0) {
    for (const err of resolver.errors) {
      console.error(`[line ${err.token.line}] Error: ${err.message}`);
    }
    hadError = true;
    return;
  }

  try {
    interpreter.interpret(statements);
  } catch (e) {
    if (e instanceof RuntimeError) {
      console.error(`[line ${e.token.line}] RuntimeError: ${e.message}`);
      hadRuntimeError = true;
    } else {
      throw e;
    }
  }
}

function runFile(path: string): void {
  const source = fs.readFileSync(path, 'utf-8');
  run(source);
  if (hadError) process.exit(65);
  if (hadRuntimeError) process.exit(70);
}

function runPrompt(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    run(line);
    hadError = false;
  });
}

const args = process.argv.slice(2);
if (args.length > 1) {
  console.error('Usage: lox [script]');
  process.exit(64);
} else if (args.length === 1) {
  runFile(args[0]);
} else {
  runPrompt();
}
