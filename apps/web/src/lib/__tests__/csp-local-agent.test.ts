// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — CSP must permit the LOCAL AGENT loopback bridge
//
// REGRESSION (found by live acceptance): the Content-Security-Policy shipped
// `connect-src 'self' https: wss:`, which forbids the browser from calling
// `http://127.0.0.1:43117` / `http://localhost:43117`. Every Local Agent call
// was therefore blocked BEFORE it left the page (console: "Connecting to
// 'http://127.0.0.1:43117/health' violates ... connect-src 'self' https: wss:"),
// so Local AI was permanently reported AGENT_UNAVAILABLE even while the agent
// and Ollama were running perfectly. The policy must allow the machine's own
// loopback interface (and nothing broader) for Local AI to be usable.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import nextConfig from '../../../next.config.js';

interface Header {
  key: string;
  value: string;
}
interface HeaderRule {
  source: string;
  headers: Header[];
}

async function contentSecurityPolicy(): Promise<string> {
  const cfg = nextConfig as unknown as { headers: () => Promise<HeaderRule[]> };
  const rules = await cfg.headers();
  const headers = rules.flatMap((rule) => rule.headers ?? []);
  return headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
}

describe('Content-Security-Policy — Local Agent loopback', () => {
  it('allows the Local Agent loopback origins in connect-src', async () => {
    const csp = await contentSecurityPolicy();
    const connectSrc =
      csp.split('; ').find((directive) => directive.startsWith('connect-src')) ?? '';
    expect(connectSrc).toContain('http://localhost:*');
    expect(connectSrc).toContain('http://127.0.0.1:*');
  });

  it('still limits connect-src to self/https/wss plus loopback (no bare http: scheme)', async () => {
    const csp = await contentSecurityPolicy();
    const connectSrc =
      csp.split('; ').find((directive) => directive.startsWith('connect-src')) ?? '';
    const sources = connectSrc.split(' ').slice(1);
    // Only the loopback hosts are added — no bare `http:` scheme wildcard.
    expect(sources).not.toContain('http:');
    expect(sources).toContain("'self'");
    expect(sources).toContain('https:');
  });
});
