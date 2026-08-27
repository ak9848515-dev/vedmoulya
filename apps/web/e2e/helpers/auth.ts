// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E Auth Helper
// Mints a JWT access token using the shared development secret and injects it
// into localStorage so the app is authenticated during E2E tests.
// BLD-016C — Real Authentication
// ─────────────────────────────────────────────────────────────────────────────

import { SignJWT } from 'jose';
import type { Page } from '@playwright/test';

// ── Constants (must match services/api + services/identity conventions) ─────

const ISSUER = 'vedmoulya';
const AUDIENCE = 'vedmoulya-api';
const TEST_USER = { userId: 'e2e-user', email: 'e2e@vedmoulya.com', role: 'user' };

// The shared secret. AUTH_JWT_SECRET is required (no default) — the core
// config fails fast when it's missing, so E2E must fail fast too instead of
// silently signing with a hardcoded 'development-secret' (P1-8).
const secret = process.env.AUTH_JWT_SECRET;
if (!secret || secret.trim() === '') {
  throw new Error(
    'AUTH_JWT_SECRET must be set to run E2E tests (required, no default). ' +
      "Generate one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
  );
}
const SECRET = new TextEncoder().encode(secret);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Mint an access token for the E2E test user. */
export async function mintAccessToken(): Promise<string> {
  return new SignJWT({
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
    .sign(SECRET);
}

/**
 * Inject the session into localStorage (key must match the auth store's
 * persist name 'vedmoulya-auth') before the app boots.
 *
 * SPRINT-088B — Also pre-dismiss the Ollama first-run prompt
 * (vedmoulya-first-run). The OllamaFirstRunDialog uses a Radix Dialog that,
 * when open, sets aria-hidden="true" on #main-content via react-remove-scroll.
 * This hides ALL page headings from the accessibility tree, causing every
 * getByRole('heading') assertion in the E2E suite to fail with "element(s)
 * not found" even though the heading IS in the DOM and visually rendered.
 */
export async function injectSession(page: Page): Promise<void> {
  const accessToken = await mintAccessToken();

  // SPRINT-090B — Include expiresAt so session-manager recognizes the token
  // as valid (not expired) without requiring an online verify.  The JWT is
  // minted with a 1-hour expiry; expiresAt = iat + 3600s in ms.
  const expiresAt = Date.now() + 3_600_000;

  await page.addInitScript(
    ({ token, user, expires }) => {
      localStorage.setItem(
        'vedmoulya-auth',
        JSON.stringify({
          state: { accessToken: token, expiresAt: expires, user },
          version: 0,
        }),
      );
      // SPRINT-088B — pre-dismiss Ollama first-run prompt so the Radix Dialog
      // never opens and does not set aria-hidden on #main-content.
      localStorage.setItem(
        'vedmoulya-first-run',
        JSON.stringify({
          state: { ollamaPromptDismissed: true },
          version: 0,
        }),
      );
    },
    { token: accessToken, user: TEST_USER, expires: expiresAt },
  );
}
