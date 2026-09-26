// Architecture guard: runtime adapters are the LocalRuntime implementation and
// must stay completely free of filesystem and workspace coupling. If a future
// change makes an adapter import the workspace package (or Node fs/path), this
// test fails — which is exactly the boundary Phase 2 relies on.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ADAPTERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'adapters');

const FORBIDDEN = [
  '@vedmoulya/local-workspace',
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:os',
  'node:child_process',
  'node:net',
  'node:vm',
];

describe('local-ai runtime adapters — isolation', () => {
  const files = readdirSync(ADAPTERS_DIR).filter((name) => name.endsWith('.ts'));

  it('has adapter files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('adapters/%s imports neither the workspace package nor Node fs/path', (file) => {
    const source = readFileSync(join(ADAPTERS_DIR, file), 'utf8');
    for (const forbidden of FORBIDDEN) {
      expect(source.includes(`from '${forbidden}'`)).toBe(false);
      expect(source.includes(`from "${forbidden}"`)).toBe(false);
      expect(source.includes(`require('${forbidden}')`)).toBe(false);
    }
  });
});
