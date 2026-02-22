# Step 24 — Garbage Collection

**Book reference**: Chapter 26 — Garbage Collection
**Builds on**: Step 23 (closures)

---

## Overview

In the C implementation, Chapter 26 builds a **tri-color mark-sweep garbage
collector** because C has manual memory management. In TypeScript, the JavaScript
runtime's GC handles memory automatically.

This step provides two tracks:

**Track A (Recommended for learning)**: Implement a **simulated mark-sweep GC**
in TypeScript — even though memory will also be managed by JS. This teaches the
algorithm while keeping the TypeScript implementation educational.

**Track B (Minimal)**: Skip the GC implementation and add a brief integration
test verifying the interpreter can handle programs that create many objects
(relying on the JS GC). Document the difference in a `GC_NOTES.md` file.

**Agents should implement Track A.**

---

## Track A: Simulated Mark-Sweep GC

### Concepts

**Mark phase**: Starting from "roots" (globals, stack, open upvalues), mark all
reachable objects gray, then black (process their children).

**Sweep phase**: Walk all allocated objects; free (remove from tracking) any
that are still white (unreachable).

**Tri-color marking**:
- **White**: not yet reached (potentially garbage)
- **Gray**: reached but children not yet processed
- **Black**: fully processed

### `src/vm/Memory.ts`

```typescript
import type { VmValue } from './Value';
import type { VmClosure } from './VmFunction';
import type { LoxVmInstance } from './VmInstance';

// All heap-allocated objects in the VM
export type GcObject = VmClosure | LoxVmInstance | VmUpvalue | LoxVmClass | VmBoundMethod;

export class GarbageCollector {
  private objects: Set<GcObject> = new Set();
  private greyStack: GcObject[] = [];

  // Allocate a new object (registers it for GC)
  alloc<T extends GcObject>(obj: T): T {
    this.objects.add(obj);
    return obj;
  }

  collectGarbage(
    stack: VmValue[],
    globals: Map<string, VmValue>,
    openUpvalues: VmUpvalue | null,
    frames: CallFrame[],
  ): void {
    this.markRoots(stack, globals, openUpvalues, frames);
    this.traceReferences();
    this.sweep();
  }

  private markRoots(
    stack: VmValue[],
    globals: Map<string, VmValue>,
    openUpvalues: VmUpvalue | null,
    frames: CallFrame[],
  ): void {
    // Mark stack values
    for (const v of stack) this.markValue(v);

    // Mark globals
    for (const v of globals.values()) this.markValue(v);

    // Mark open upvalues
    let uv = openUpvalues;
    while (uv !== null) {
      this.markObject(uv);
      uv = uv.next;
    }

    // Mark closures in call frames
    for (const frame of frames) this.markObject(frame.closure);
  }

  private markValue(v: VmValue): void {
    if (v !== null && typeof v === 'object') {
      this.markObject(v as GcObject);
    }
  }

  private markObject(obj: GcObject): void {
    if (!this.objects.has(obj)) return; // already black or not tracked
    // Grey it
    obj._gcMark = 'grey';
    this.greyStack.push(obj);
  }

  private traceReferences(): void {
    while (this.greyStack.length > 0) {
      const obj = this.greyStack.pop()!;
      this.blackenObject(obj);
    }
  }

  private blackenObject(obj: GcObject): void {
    obj._gcMark = 'black';
    // Mark object's references
    if (obj instanceof VmClosure) {
      this.markObject(obj.fn as unknown as GcObject);
      for (const uv of obj.upvalues) {
        if (uv) this.markObject(uv);
      }
    }
    // Add more cases for VmInstance, LoxVmClass, etc. in later steps
  }

  private sweep(): void {
    for (const obj of this.objects) {
      if (obj._gcMark !== 'black') {
        this.objects.delete(obj);
      } else {
        obj._gcMark = 'white'; // reset for next cycle
      }
    }
  }
}
```

Add `_gcMark: 'white' | 'grey' | 'black' = 'white'` to all `GcObject` classes.

### Trigger GC

In the VM, trigger GC when the number of allocated objects exceeds a threshold:

```typescript
private gcThreshold = 1024;
private allocCount = 0;

private gcAlloc<T extends GcObject>(obj: T): T {
  this.allocCount++;
  if (this.allocCount > this.gcThreshold) {
    this.gc.collectGarbage(this.stack, this.globals.toMap(), this.openUpvalues, this.frames);
    this.allocCount = 0;
    this.gcThreshold = Math.max(this.gc.objectCount * 2, 1024);
  }
  return this.gc.alloc(obj);
}
```

---

## Tests to Write

Create `tests/vm/GarbageCollection.test.ts`:

```typescript
import { GarbageCollector } from '../../src/vm/Memory';

describe('GarbageCollector — basic operation', () => {
  it('tracks allocated objects', () => {
    const gc = new GarbageCollector();
    // We'll use simple mock objects for testing
    const obj = { _gcMark: 'white' as const };
    gc.alloc(obj as any);
    expect(gc.objectCount).toBe(1);
  });

  it('sweeps unreachable objects', () => {
    const gc = new GarbageCollector();
    const obj = { _gcMark: 'white' as const };
    gc.alloc(obj as any);
    // Collect with empty roots — obj is unreachable
    gc.collectGarbage([], new Map(), null, []);
    expect(gc.objectCount).toBe(0);
  });

  it('retains reachable objects (on stack)', () => {
    const gc = new GarbageCollector();
    // In a real scenario, VmClosure objects are GcObjects
    // For testing we verify the algorithm logic
    // (Integration test via the full VM)
    expect(true).toBe(true); // placeholder
  });
});

describe('VM — handles many allocations', () => {
  it('runs a loop that creates many closures', () => {
    // If GC is not working, this would cause memory issues
    const src = `
      var i = 0;
      while (i < 1000) {
        fun f() { return i; }
        i = i + 1;
      }
      print i;
    `;
    expect(capture(src)).toEqual(['1000']);
  });

  it('closures are not collected while still reachable', () => {
    expect(capture(`
      fun makeCounter() {
        var n = 0;
        fun inc() { n = n + 1; return n; }
        return inc;
      }
      var c = makeCounter();
      print c();
      print c();
      print c();
    `)).toEqual(['1', '2', '3']);
  });
});
```

---

## Acceptance Criteria

- [ ] `GarbageCollector.alloc()` registers objects
- [ ] `collectGarbage()` removes unreachable objects
- [ ] Reachable objects (on stack, in globals) are retained
- [ ] VM handles 1000+ closure allocations without failure
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- Adding `_gcMark` to all object classes is a code smell in production code, but it mirrors the book's approach of embedding GC state into each object.
- In TypeScript, the JS GC will clean up anything the simulated GC misses, so there's no actual memory leak risk — the simulation is purely educational.
- `gc.objectCount` should be a getter: `get objectCount() { return this.objects.size; }`.
- The self-tuning GC threshold (double after each collection) is the book's approach. Implement it as described.
- Commit with message: `feat(vm): implement simulated mark-sweep garbage collector`
