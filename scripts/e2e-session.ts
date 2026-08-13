#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Browser Journey Session Helper (EPIC-019/13)
//
//   npx tsx scripts/e2e-session.ts
//
// Prints the exact `vedmoulya-auth` localStorage payload used by the repo's
// Playwright E2E journeys (apps/web/e2e/helpers/auth.ts) so a real-Chrome
// browser session can inject the deterministic dev identity BEFORE the app
// boots:
//
//   localStorage.setItem('vedmoulya-auth', '<printed payload>')
//
// The token is a short-lived (1h) dev-only JWT for the e2e-user, signed with
// the local AUTH_JWT_SECRET (loaded from apps/web/.env.local in development).
// It is NEVER used in production and must never be committed. This is the
// same deterministic dev-auth mechanism the e2e suite already uses — no new
// auth path is introduced.
// ─────────────────────────────────────────────────────────────────────────────

import { SignJWT } from 'jose';
import { loadEnvironment, resolveMode } from './lib/probes.js';

const ISSUER = 'vedmoulya';
const AUDIENCE = 'vedmoulya-api';
const TEST_USER = { userId: 'e2e-user', email: 'e2e@vedmoulya.com', role: 'user' };

async function main(): Promise<void> {
  const mode = resolveMode(process.argv.slice(2));
  if (mode === 'production' || mode === 'staging') {
    console.error(
      'Refusing to mint a session helper token in a strict mode (never used in production).',
    );
    process.exit(2);
  }
  loadEnvironment(mode);

  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.trim() === '') {
    console.error(
      'AUTH_JWT_SECRET must be set (required, no default) to mint a browser-journey session.',
    );
    process.exit(1);
  }

  const accessToken = await new SignJWT({
    sub: TEST_USER.userId,
    email: TEST_USER.email,
    role: TEST_USER.role,
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime('1h')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(new TextEncoder().encode(secret));

  const payload = JSON.stringify({
    state: { accessToken, user: TEST_USER },
    version: 0,
  });
  console.log(payload);
}

void main();
