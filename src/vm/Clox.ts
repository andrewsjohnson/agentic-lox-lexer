import * as fs from 'fs';
import * as readline from 'readline';
import { VM, InterpretResult } from './VM';

const vm = new VM();

function runFile(path: string): void {
  const source = fs.readFileSync(path, 'utf8');
  const result = vm.interpretSource(source);
  if (result === InterpretResult.COMPILE_ERROR) process.exit(65);
  if (result === InterpretResult.RUNTIME_ERROR) process.exit(70);
}

function repl(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => {
    rl.question('> ', (line) => {
      vm.interpretSource(line);
      prompt();
    });
  };
  prompt();
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
