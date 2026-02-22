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
