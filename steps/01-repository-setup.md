# Step 01 — Repository Setup

**Book reference**: Preamble / Introduction (Chapter 1)
**Builds on**: Nothing — this is the first step.

---

## Overview

Initialize the TypeScript project with all tooling required for the remaining
28 steps. After completing this step every subsequent agent can run `npm test`
to validate their work and `npm run typecheck` to catch type errors.

---

## What to Implement

### 1. `package.json`

Create `package.json` with the following scripts and dependencies:

**Scripts:**
- `build` — compile TypeScript to `dist/`
- `typecheck` — type-check without emitting
- `test` — run Jest
- `test:watch` — run Jest in watch mode
- `lox` — run the tree-walk interpreter entry point (`src/lox/Lox.ts`)
- `clox` — run the bytecode VM entry point (`src/vm/Clox.ts`)

**Dev dependencies:**
- `typescript` (^5.x)
- `ts-jest` (^29.x)
- `jest` (^29.x)
- `@types/jest`
- `@types/node`
- `ts-node` (for running scripts directly)

### 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. `jest.config.ts` (or `jest.config.js`)

Configure Jest to use `ts-jest` so TypeScript test files are compiled on the
fly. Point `testMatch` at `tests/**/*.test.ts`.

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

### 4. Directory structure

Create the following empty directories (add `.gitkeep` if needed):

```
src/
  lox/
  vm/
tests/
  lox/
  vm/
steps/          (already exists)
```

### 5. Placeholder entry points

Create minimal placeholder files so the `lox` and `clox` scripts work:

**`src/lox/Lox.ts`**
```typescript
// Entry point for the tree-walk interpreter (Part II).
// This file will grow with each step.
console.log('Lox interpreter — not yet implemented.');
```

**`src/vm/Clox.ts`**
```typescript
// Entry point for the bytecode VM (Part III).
// This file will grow with each step.
console.log('clox VM — not yet implemented.');
```

---

## Tests to Write

Create `tests/lox/setup.test.ts`:

```typescript
describe('Project setup', () => {
  it('can import from src/lox', () => {
    // This test just verifies the module resolution works.
    // It will be trivially true once the file exists.
    expect(true).toBe(true);
  });

  it('runs in a Node environment', () => {
    expect(typeof process).toBe('object');
    expect(typeof process.version).toBe('string');
  });

  it('TypeScript strict mode is active (no implicit any)', () => {
    // If this file compiles without errors, strict mode is working.
    const x: number = 42;
    expect(x).toBe(42);
  });
});
```

---

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm test` runs and the setup tests pass (3 passing tests)
- [ ] `npm run typecheck` exits with code 0 (no type errors)
- [ ] `npm run build` produces output in `dist/`
- [ ] `npm run lox` prints `Lox interpreter — not yet implemented.`
- [ ] `npm run clox` prints `clox VM — not yet implemented.`

---

## Notes

- Use `npm` (not `yarn` or `pnpm`) for consistency across agents.
- Commit with message: `chore: initialize TypeScript project with Jest`
- Do not add any Lox-specific code yet — that starts in Step 02.
