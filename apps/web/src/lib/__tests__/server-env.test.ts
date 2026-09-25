// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Next.js Server Environment Boundary tests (PROD-02B)
//
// Locks in the deterministic environment contract:
//   • development/test load root `.env.local` then `apps/web/.env.local`
//   • production/staging load NO local file (platform-only, fail-closed)
//   • precedence: an already-set key is never overwritten
//   • the contract list is NAMES-only (no secret value can leak)
//   • no secret is reachable through a NEXT_PUBLIC_* name
//   • next.config.ts wiring cannot silently diverge from this module
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SERVER_ENV_KEYS,
  applyServerEnv,
  describeServerEnv,
  findLeakedPublicSecrets,
  findRepoRoot,
  localEnvFilePaths,
  resetServerEnvForTesting,
  shouldLoadLocalEnvFiles,
} from '../server-env.js';

const ENV_LOCAL = '.env.local';

describe('shouldLoadLocalEnvFiles', () => {
  it('loads local files in development and test only', () => {
    expect(shouldLoadLocalEnvFiles('development')).toBe(true);
    expect(shouldLoadLocalEnvFiles('test')).toBe(true);
    expect(shouldLoadLocalEnvFiles(undefined)).toBe(true); // dev default
  });

  it('never loads local files in production or staging', () => {
    expect(shouldLoadLocalEnvFiles('production')).toBe(false);
    expect(shouldLoadLocalEnvFiles('staging')).toBe(false);
  });
});

describe('localEnvFilePaths', () => {
  it('orders root before app-local so app-local wins per key', () => {
    const paths = localEnvFilePaths('D:\\repo');
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe(join('D:\\repo', ENV_LOCAL));
    expect(paths[1]).toBe(join('D:\\repo', 'apps', 'web', ENV_LOCAL));
  });
});

describe('findRepoRoot', () => {
  it('resolves the monorepo root from the web app directory', () => {
    // The web workspace lives at <repo>/apps/web — the root must contain both
    // the core package and the web app, and must never be the web dir itself.
    const root = findRepoRoot();
    expect(existsSync(join(root, 'packages', 'core', 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'apps', 'web', 'package.json'))).toBe(true);
    expect(root.endsWith(`${sep}web`)).toBe(false);
  });

  it('never picks an unrelated ancestor checkout that lacks the web app', () => {
    // A directory that has packages/core but NO apps/web must NOT qualify as
    // a root (this is the exact failure mode that made a temp fixture load the
    // real checkout's env files).
    const partial = mkdtempSync(join(tmpdir(), 'vm-partial-'));
    try {
      mkdirSync(join(partial, 'packages', 'core'), { recursive: true });
      writeFileSync(join(partial, 'packages', 'core', 'package.json'), '{}', 'utf8');
      expect(findRepoRoot(partial)).toBe(resolve(partial));
    } finally {
      rmSync(partial, { recursive: true, force: true });
    }
  });

  it('resolves a coherent fixture root from a nested directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-coherent-'));
    try {
      mkdirSync(join(root, 'packages', 'core'), { recursive: true });
      mkdirSync(join(root, 'apps', 'web'), { recursive: true });
      writeFileSync(join(root, 'packages', 'core', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, 'apps', 'web', 'package.json'), '{}', 'utf8');
      expect(findRepoRoot(join(root, 'apps', 'web'))).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('applyServerEnv', () => {
  afterEach(() => {
    resetServerEnvForTesting();
  });

  it('loads root then app-local in development', () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-repo-'));
    try {
      mkdirSync(join(root, 'packages', 'core'), { recursive: true });
      mkdirSync(join(root, 'apps', 'web'), { recursive: true });
      writeFileSync(join(root, 'packages', 'core', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, 'apps', 'web', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, ENV_LOCAL), 'FROM_ROOT=1\n', 'utf8');
      writeFileSync(join(root, 'apps', 'web', ENV_LOCAL), 'FROM_WEB=1\n', 'utf8');
      // Guard the fixture itself: a DIRECTORY here would silently be skipped
      // by existsSync and make this test vacuous.
      expect(existsSync(join(root, ENV_LOCAL))).toBe(true);
      expect(existsSync(join(root, 'apps', 'web', ENV_LOCAL))).toBe(true);

      const seen: string[] = [];
      const result = applyServerEnv({
        nodeEnv: 'development',
        cwd: join(root, 'apps', 'web'),
        loadEnvFile: (path) => seen.push(path),
      });

      expect(result.localFilesApplied).toBe(true);
      expect(result.errors).toEqual([]);
      expect(seen).toEqual([join(root, ENV_LOCAL), join(root, 'apps', 'web', ENV_LOCAL)]);
      expect(result.loaded).toEqual(seen);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads NO local file in production (platform-only)', () => {
    const result = applyServerEnv({
      nodeEnv: 'production',
      cwd: process.cwd(),
      loadEnvFile: () => {
        throw new Error('must not be called in production');
      },
    });

    expect(result.localFilesApplied).toBe(false);
    expect(result.loaded).toEqual([]);
  });

  it('is idempotent — a second call does not re-read files', () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-repo-'));
    try {
      mkdirSync(join(root, 'packages', 'core'), { recursive: true });
      mkdirSync(join(root, 'apps', 'web'), { recursive: true });
      writeFileSync(join(root, 'packages', 'core', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, 'apps', 'web', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, ENV_LOCAL), 'A=1\n', 'utf8');

      let calls = 0;
      const loader = (): void => {
        calls += 1;
      };
      applyServerEnv({ nodeEnv: 'development', cwd: root, loadEnvFile: loader });
      applyServerEnv({ nodeEnv: 'development', cwd: root, loadEnvFile: loader });

      expect(calls).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a failing file by name without throwing', () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-repo-'));
    try {
      mkdirSync(join(root, 'packages', 'core'), { recursive: true });
      mkdirSync(join(root, 'apps', 'web'), { recursive: true });
      writeFileSync(join(root, 'packages', 'core', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, 'apps', 'web', 'package.json'), '{}', 'utf8');
      writeFileSync(join(root, ENV_LOCAL), 'A=1\n', 'utf8');

      const result = applyServerEnv({
        nodeEnv: 'development',
        cwd: root,
        loadEnvFile: (path) => {
          throw new Error(`parse error in ${path}`);
        },
      });

      expect(result.errors).toHaveLength(1);
      // The FILE is named; no file CONTENT is ever echoed.
      expect(result.errors[0]).toContain(ENV_LOCAL);
      expect(result.errors[0]).not.toContain('A=1');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('SERVER_ENV_KEYS contract', () => {
  it('names every provider key the release retest exercises', () => {
    // Google/Gemini, Ollama and the OpenRouter switch must all be configurable
    // from the server-side surface.
    expect(SERVER_ENV_KEYS.aiProviders).toContain('AI_GOOGLE_API_KEY');
    expect(SERVER_ENV_KEYS.aiProviders).toContain('AI_OLLAMA_BASE_URL');
    // OpenRouter is reached through a user-registered OpenAI-compatible
    // endpoint (no platform key) — the runtime switches are default + routing.
    expect(SERVER_ENV_KEYS.aiProviders).toContain('AI_DEFAULT_PROVIDER');
    expect(SERVER_ENV_KEYS.aiProviders).toContain('AI_ROUTING_STRATEGY');
  });

  it('keeps Google OAuth credentials separate from the Google AI key', () => {
    expect(SERVER_ENV_KEYS.oauth).toContain('GOOGLE_CLIENT_ID');
    expect(SERVER_ENV_KEYS.oauth).toContain('GOOGLE_CLIENT_SECRET');
    expect(SERVER_ENV_KEYS.oauth).not.toContain('AI_GOOGLE_API_KEY');
    expect(SERVER_ENV_KEYS.aiProviders).not.toContain('GOOGLE_CLIENT_ID');
  });

  it('never contains a NEXT_PUBLIC_* name', () => {
    const all = Object.values(SERVER_ENV_KEYS).flat() as readonly string[];
    expect(all.some((name) => name.startsWith('NEXT_PUBLIC_'))).toBe(false);
  });
});

describe('describeServerEnv', () => {
  it('reports presence by NAME only — never a value', () => {
    const report = describeServerEnv({ AUTH_JWT_SECRET: 'super-secret-value', REDIS_URL: '' });

    expect(report.present).toContain('AUTH_JWT_SECRET');
    expect(report.missing).toContain('REDIS_URL');
    // A blank string is absent, and no value is surfaced anywhere.
    expect(JSON.stringify(report)).not.toContain('super-secret-value');
  });
});

describe('findLeakedPublicSecrets', () => {
  it('flags a secret exposed under a NEXT_PUBLIC_ name', () => {
    expect(findLeakedPublicSecrets({ NEXT_PUBLIC_AI_GOOGLE_API_KEY: 'x' })).toEqual([
      'NEXT_PUBLIC_AI_GOOGLE_API_KEY',
    ]);
  });

  it('allows the documented non-secret public URLs', () => {
    expect(
      findLeakedPublicSecrets({
        NEXT_PUBLIC_GATEWAY_URL: 'https://api.example.com',
        NEXT_PUBLIC_IDENTITY_URL: 'https://api.example.com',
      }),
    ).toEqual([]);
  });
});

describe('next.config.ts wiring', () => {
  it('loads the SAME two files in the SAME order as this module', () => {
    // Anchor on the repo root THIS module resolves (its own file location),
    // never on process.cwd(): the root `npm test` run evaluates this file with
    // cwd = the monorepo root, so `join(process.cwd(), 'next.config.ts')`
    // resolved `<repo>/next.config.ts` and failed with ENOENT. findRepoRoot()
    // is the same authoritative anchor server-env.ts uses at runtime, so this
    // also asserts the config file is wired to the root the module computes.
    const configSource = readFileSync(
      join(findRepoRoot(), 'apps', 'web', 'next.config.ts'),
      'utf8',
    );

    // Root first, app-local second — identical to localEnvFilePaths().
    expect(configSource).toContain("join(repoRoot, '.env.local')");
    expect(configSource).toContain("join(repoRoot, 'apps', 'web', '.env.local')");
    // Production/staging must stay platform-only.
    expect(configSource).toContain("nodeEnv !== 'production' && nodeEnv !== 'staging'");
    // The repo root marker must match findRepoRoot().
    expect(configSource).toContain("'packages', 'core', 'package.json'");
  });
});
