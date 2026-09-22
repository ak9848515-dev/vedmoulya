// @vitest-environment node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Service worker cache-eligibility (G8.4)
//
// A stale Next.js App Router RSC payload replayed against a newer client bundle
// desynchronises the hydrated tree and React throws #41 ("Target container is
// not valid"). sw.js must therefore NEVER treat RSC / client-navigation traffic
// as cache-first static assets — while genuinely static GETs keep their
// existing caching behaviour.
//
// This loads the REAL public/sw.js (not a copy of its logic) and exercises the
// shipped `isCacheableGet` predicate, so the regression is pinned to the file
// that actually ships to the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const ORIGIN = 'https://vedmoulya-web.vercel.app';

/** Minimal Request-like object with the fields isCacheableGet reads. */
interface FakeRequest {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
}

function makeRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): FakeRequest {
  const headers = init.headers ?? {};
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    method: init.method ?? 'GET',
    url,
    headers: {
      get: (name: string): string | null => {
        const key = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(lower, key) ? (lower[key] as string) : null;
      },
    },
  };
}

let isCacheableGet: (request: FakeRequest) => boolean;
let cacheVersion: string;

beforeAll(() => {
  const here = dirname(fileURLToPath(import.meta.url));
  // apps/web/src/lib/__tests__ → apps/web/public/sw.js
  const swPath = resolve(here, '../../../public/sw.js');
  const source = readFileSync(swPath, 'utf8');

  // The SW is a plain script (not a module). Run it in an isolated sandbox with
  // just enough of the worker global scope for the top-level definitions, then
  // pull the predicate back out. Nothing in the file executes a fetch/event
  // handler at load time, so the stubs are never exercised beyond definition.
  const sandbox: Record<string, unknown> = {
    self: { location: { origin: ORIGIN }, addEventListener: () => undefined },
    caches: { open: () => Promise.resolve({ put: () => Promise.resolve() }) },
    Response: class {},
    URL,
    console,
  };
  vm.createContext(sandbox);
  const exported = `${source}\n;globalThis.__isCacheableGet = isCacheableGet; globalThis.__cacheVersion = CACHE_VERSION;`;
  vm.runInContext(exported, sandbox);
  isCacheableGet = (sandbox as { __isCacheableGet: (r: FakeRequest) => boolean }).__isCacheableGet;
  cacheVersion = (sandbox as { __cacheVersion: string }).__cacheVersion;
});

describe('sw.js isCacheableGet — RSC / client navigation is never cache-first (G8.4)', () => {
  it('rejects a Next.js RSC navigation fetch (_rsc query parameter)', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/providers?_rsc=1a2b3c`))).toBe(false);
  });

  it('rejects a request carrying the RSC header', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/providers`, { headers: { RSC: '1' } }))).toBe(
      false,
    );
  });

  it('rejects a request carrying the Next-Router-State-Tree header', () => {
    expect(
      isCacheableGet(
        makeRequest(`${ORIGIN}/providers`, {
          headers: { 'Next-Router-State-Tree': '%5B%22%22%5D' },
        }),
      ),
    ).toBe(false);
  });

  it('rejects a request that accepts the RSC payload media type', () => {
    expect(
      isCacheableGet(
        makeRequest(`${ORIGIN}/providers`, { headers: { Accept: 'text/x-component' } }),
      ),
    ).toBe(false);
  });

  it('rejects an RSC request even though its pathname looks static', () => {
    // The decisive case: /providers is NOT under /api/ and IS same-origin, so
    // before this guard it was cached and replayed — the exact React #41 path.
    expect(isCacheableGet(makeRequest(`${ORIGIN}/providers?_rsc=zzz`))).toBe(false);
  });

  it('rejects non-GET RSC requests', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/providers?_rsc=1`, { method: 'POST' }))).toBe(
      false,
    );
  });
});

describe('sw.js isCacheableGet — existing static caching behaviour is preserved', () => {
  it('still caches an ordinary same-origin static GET', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/manifest.json`))).toBe(true);
  });

  it('still caches a hashed Next.js static chunk', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/_next/static/chunks/main-app-abc.js`))).toBe(true);
  });

  it('still never caches authenticated API endpoints', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/api/trpc/providers.getExperience`))).toBe(false);
  });

  it('still ignores cross-origin requests', () => {
    expect(isCacheableGet(makeRequest('https://api.openai.com/v1/models'))).toBe(false);
  });

  it('still ignores non-GET requests', () => {
    expect(isCacheableGet(makeRequest(`${ORIGIN}/manifest.json`, { method: 'POST' }))).toBe(false);
  });
});

describe('sw.js cache version', () => {
  it('was bumped past vedmoulya-v2 so previously cached RSC entries are purged', () => {
    expect(cacheVersion).not.toBe('vedmoulya-v2');
    expect(cacheVersion.startsWith('vedmoulya-v')).toBe(true);
  });
});
