# Step 18 — Hash Tables

**Book reference**: Chapter 20 — Hash Tables
**Builds on**: Step 17 (strings)

---

## Overview

In the C implementation, Chapter 20 builds a custom hash table from scratch
(open addressing with linear probing). This is necessary because C has no
built-in hash map.

In TypeScript, we have `Map<K, V>` — but **implementing the hash table from
scratch is still highly educational** and the book spends a full chapter on it.
This step implements a **custom open-addressing hash table** in TypeScript to
mirror the book's approach, even though `Map` would be simpler.

The hash table will be used in the VM for:
- **Global variables** (Step 19)
- **String interning** (already implicit in JS, but simulated here)
- **Instance fields** (Step 25)
- **Method tables in classes** (Step 25)

---

## What to Implement

### `src/vm/Table.ts`

Implement an open-addressing hash table with FNV-1a string hashing:

```typescript
const TABLE_MAX_LOAD = 0.75;

interface Entry {
  key: string | null;    // null = tombstone or empty
  value: VmValue;
  isDeleted: boolean;    // tombstone marker
}

export class Table {
  private entries: (Entry | null)[] = [];
  private count: number = 0;   // live entries + tombstones
  private capacity: number = 0;

  get(key: string): VmValue | undefined {
    if (this.capacity === 0) return undefined;
    const entry = this.findEntry(key);
    if (!entry || entry.key === null) return undefined;
    return entry.value;
  }

  set(key: string, value: VmValue): boolean {
    if (this.count + 1 > this.capacity * TABLE_MAX_LOAD) {
      this.adjustCapacity(Math.max(8, this.capacity * 2));
    }
    const entry = this.findEntry(key)!;
    const isNewKey = entry.key === null;
    if (isNewKey && !entry.isDeleted) this.count++;
    entry.key = key;
    entry.value = value;
    entry.isDeleted = false;
    return isNewKey;
  }

  delete(key: string): boolean {
    if (this.capacity === 0) return false;
    const entry = this.findEntry(key);
    if (!entry || entry.key === null) return false;
    // Mark as tombstone
    entry.key = null;
    entry.isDeleted = true;
    return true;
  }

  addAll(from: Table): void {
    for (const entry of from.entries) {
      if (entry && entry.key !== null) {
        this.set(entry.key, entry.value);
      }
    }
  }

  private findEntry(key: string): Entry | null {
    let index = fnv1a(key) % this.capacity;
    let tombstone: Entry | null = null;
    while (true) {
      const entry = this.entries[index] ?? null;
      if (!entry || (entry.key === null && !entry.isDeleted)) {
        return tombstone ?? entry ?? this.emptyEntry(index);
      }
      if (entry.isDeleted) {
        tombstone = tombstone ?? entry;
      } else if (entry.key === key) {
        return entry;
      }
      index = (index + 1) % this.capacity;
    }
  }

  private emptyEntry(index: number): Entry {
    const e: Entry = { key: null, value: null, isDeleted: false };
    this.entries[index] = e;
    return e;
  }

  private adjustCapacity(newCapacity: number): void {
    const newEntries: (Entry | null)[] = new Array(newCapacity).fill(null);
    // Rehash all live entries
    const oldEntries = this.entries;
    this.entries = newEntries;
    this.capacity = newCapacity;
    this.count = 0;
    for (const entry of oldEntries) {
      if (entry && entry.key !== null) {
        this.set(entry.key, entry.value);
      }
    }
  }
}

// FNV-1a hash for strings
function fnv1a(s: string): number {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0; // FNV prime, keep 32-bit
  }
  return hash;
}
```

---

## Tests to Write

Create `tests/vm/Table.test.ts`:

```typescript
import { Table } from '../../src/vm/Table';

describe('Table — basic operations', () => {
  it('starts empty', () => {
    const t = new Table();
    expect(t.get('key')).toBeUndefined();
  });

  it('sets and gets a value', () => {
    const t = new Table();
    t.set('x', 42);
    expect(t.get('x')).toBe(42);
  });

  it('returns undefined for missing keys', () => {
    const t = new Table();
    t.set('x', 1);
    expect(t.get('y')).toBeUndefined();
  });

  it('overwrites an existing value', () => {
    const t = new Table();
    t.set('x', 1);
    t.set('x', 2);
    expect(t.get('x')).toBe(2);
  });

  it('set returns true for new key', () => {
    const t = new Table();
    expect(t.set('a', 1)).toBe(true);
  });

  it('set returns false for existing key', () => {
    const t = new Table();
    t.set('a', 1);
    expect(t.set('a', 2)).toBe(false);
  });
});

describe('Table — deletion', () => {
  it('deletes a key', () => {
    const t = new Table();
    t.set('x', 1);
    t.delete('x');
    expect(t.get('x')).toBeUndefined();
  });

  it('can re-insert after delete', () => {
    const t = new Table();
    t.set('x', 1);
    t.delete('x');
    t.set('x', 99);
    expect(t.get('x')).toBe(99);
  });

  it('delete returns false for non-existent key', () => {
    const t = new Table();
    expect(t.delete('nope')).toBe(false);
  });
});

describe('Table — multiple entries', () => {
  it('handles many entries', () => {
    const t = new Table();
    for (let i = 0; i < 100; i++) {
      t.set(`key${i}`, i);
    }
    for (let i = 0; i < 100; i++) {
      expect(t.get(`key${i}`)).toBe(i);
    }
  });

  it('grows correctly beyond initial capacity', () => {
    const t = new Table();
    for (let i = 0; i < 20; i++) t.set(`k${i}`, i * 2);
    for (let i = 0; i < 20; i++) expect(t.get(`k${i}`)).toBe(i * 2);
  });
});

describe('Table — addAll', () => {
  it('copies entries from one table to another', () => {
    const a = new Table();
    a.set('x', 1);
    a.set('y', 2);
    const b = new Table();
    b.addAll(a);
    expect(b.get('x')).toBe(1);
    expect(b.get('y')).toBe(2);
  });
});

describe('Table — collision resistance', () => {
  it('handles keys that might collide', () => {
    const t = new Table();
    // These strings might hash to nearby buckets
    t.set('ab', 1);
    t.set('ba', 2);
    t.set('aab', 3);
    expect(t.get('ab')).toBe(1);
    expect(t.get('ba')).toBe(2);
    expect(t.get('aab')).toBe(3);
  });
});
```

---

## Acceptance Criteria

- [ ] All hash table tests pass
- [ ] Table correctly handles get/set/delete operations
- [ ] Table grows when load factor exceeds `TABLE_MAX_LOAD` (0.75)
- [ ] Tombstones allow correct re-insertion after deletion
- [ ] `addAll` merges tables correctly
- [ ] 100 entries don't cause collisions that break lookup
- [ ] No TypeScript errors
- [ ] All previous tests still pass

---

## Notes

- FNV-1a is the hash function used in the book. Use `Math.imul()` to keep multiplication within 32-bit integer bounds in JavaScript.
- The `>>>  0` after the multiplication converts the result to an unsigned 32-bit integer.
- **Tombstones**: When deleting, mark the slot as a tombstone (`isDeleted = true, key = null`) rather than clearing it — otherwise, subsequent gets for keys that probed past this slot would fail to find them.
- In Step 19, this `Table` will replace the `Map` used for global variables in the VM.
- Commit with message: `feat(vm): implement custom open-addressing hash table`
