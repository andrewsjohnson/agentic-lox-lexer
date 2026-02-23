// Entry point for the bytecode VM (Part III).
import * as fs from 'fs';
import * as readline from 'readline';
import { VM, InterpretResult } from './VM';

function repl(): void {
  const vm = new VM();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (): void => {
    rl.question('> ', (line) => {
      vm.interpretSource(line);
      prompt();
    });
  };
  prompt();
}

function runFile(path: string): void {
  let source: string;
  try {
    source = fs.readFileSync(path, 'utf-8');
  } catch {
    console.error(`Could not open file "${path}".`);
    process.exit(74);
  }
  const vm = new VM();
  const result = vm.interpretSource(source);
  if (result === InterpretResult.COMPILE_ERROR) process.exit(65);
  if (result === InterpretResult.RUNTIME_ERROR) process.exit(70);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  repl();
} else if (args.length === 1) {
  runFile(args[0]);
} else {
  console.error('Usage: clox [path]');
  process.exit(64);
}
