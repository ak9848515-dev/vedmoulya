// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — E2E Auth Diagnostics (SPRINT-086)
// Temporary instrumentation to capture auth request outcomes during E2E.
// Logs to stdout so CI artifacts capture the real HTTP status codes.
//
// DO NOT COMMIT — diagnostic-only, remove after root cause is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

import type { Page } from '@playwright/test';

/** Collected auth diagnostic data for a single page session. */
export interface AuthDiagnostics {
  /** GET /api/v1/identity/auth/session — first request */
  sessionRequest: {
    url: string;
    method: string;
    status: number | null;
    durationMs: number;
    bodySnippet: string;
  } | null;
  /** GET /api/v1/identity/auth/me — second request */
  meRequest: {
    url: string;
    method: string;
    status: number | null;
    durationMs: number;
    bodySnippet: string;
  } | null;
  /** Browser state captured after waiting for sessionReady */
  browserState: {
    sessionReady: boolean;
    userPresent: boolean;
    pathname: string;
    localStorageAuth: string;
  } | null;
}

/**
 * Install auth request interceptors on a page.
 * Call BEFORE page.goto(). Then call `captureBrowserState()` after
 * the expected heading timeout to get the full picture.
 */
export function installAuthDiagnostics(page: Page): AuthDiagnostics {
  const diag: AuthDiagnostics = {
    sessionRequest: null,
    meRequest: null,
    browserState: null,
  };

  let sessionStart = 0;
  let meStart = 0;

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/v1/identity/auth/session')) {
      sessionStart = Date.now();
    }
    if (url.includes('/api/v1/identity/auth/me')) {
      meStart = Date.now();
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    try {
      if (url.includes('/api/v1/identity/auth/session') && !diag.sessionRequest) {
        let bodySnippet = '';
        try {
          const body = await res.text();
          // Safe snippet: first 300 chars, redact any token-like values
          bodySnippet = body
            .substring(0, 300)
            .replace(/"[aA]ccess[Tt]oken"\s*:\s*"[^"]*"/g, '"accessToken": "***REDACTED***"')
            .replace(/"[rR]efresh[Tt]oken"\s*:\s*"[^"]*"/g, '"refreshToken": "***REDACTED***"');
        } catch {
          bodySnippet = '<body unavailable>';
        }
        diag.sessionRequest = {
          url,
          method: res.request().method(),
          status: res.status(),
          durationMs: sessionStart > 0 ? Date.now() - sessionStart : -1,
          bodySnippet,
        };
        console.warn(
          `[AUTH-DIAG] session: ${res.status()} ${res.request().method()} ${url} (${diag.sessionRequest.durationMs}ms)`,
        );
        console.warn(`[AUTH-DIAG] session body: ${bodySnippet}`);
      }
      if (url.includes('/api/v1/identity/auth/me') && !diag.meRequest) {
        let bodySnippet = '';
        try {
          const body = await res.text();
          bodySnippet = body
            .substring(0, 300)
            .replace(/"[aA]ccess[Tt]oken"\s*:\s*"[^"]*"/g, '"accessToken": "***REDACTED***"')
            .replace(/"[rR]efresh[Tt]oken"\s*:\s*"[^"]*"/g, '"refreshToken": "***REDACTED***"');
        } catch {
          bodySnippet = '<body unavailable>';
        }
        diag.meRequest = {
          url,
          method: res.request().method(),
          status: res.status(),
          durationMs: meStart > 0 ? Date.now() - meStart : -1,
          bodySnippet,
        };
        console.warn(
          `[AUTH-DIAG] me: ${res.status()} ${res.request().method()} ${url} (${diag.meRequest.durationMs}ms)`,
        );
        console.warn(`[AUTH-DIAG] me body: ${bodySnippet}`);
      }
    } catch {
      // Response body may be unavailable (e.g., redirect). Swallow.
    }
  });

  return diag;
}

/** Shape of the zustand persist JSON stored in localStorage. */
interface PersistedAuthState {
  state?: {
    user?: unknown;
    accessToken?: unknown;
  };
  version?: number;
}

/**
 * Capture browser-side auth state AFTER the page has had time to process.
 * Call this in a test after the assertion timeout to see what actually
 * happened in the browser.
 */
export async function captureBrowserState(page: Page): Promise<AuthDiagnostics['browserState']> {
  try {
    const state = await page.evaluate(
      (): {
        sessionReady: boolean;
        userPresent: boolean;
        pathname: string;
        localStorageAuth: string;
      } => {
        const localStorageRaw = localStorage.getItem('vedmoulya-auth') ?? '<null>';
        // Redact token values from localStorage dump
        const redacted = localStorageRaw
          .replace(/"[aA]ccess[Tt]oken"\s*:\s*"[^"]*"/g, '"accessToken": "***REDACTED***"')
          .replace(/"[rR]efresh[Tt]oken"\s*:\s*"[^"]*"/g, '"refreshToken": "***REDACTED***"');

        // Detect sessionReady by checking the zustand persist store state.
        // The store key is 'vedmoulya-auth'; after doRestore() completes,
        // the in-memory zustand store has sessionReady=true even though
        // there is no DOM attribute. We can't read zustand state directly
        // from page.evaluate, but we CAN infer it: if localStorage has a
        // user AND no SignInRedirect fired (pathname hasn't changed to
        // /login), then auth succeeded.
        let sessionReadyInferred = false;
        try {
          const raw = localStorage.getItem('vedmoulya-auth');
          if (raw) {
            const parsed = JSON.parse(raw) as PersistedAuthState;
            const hasUser = parsed.state?.user !== null && parsed.state?.user !== undefined;
            const hasToken =
              parsed.state?.accessToken !== null && parsed.state?.accessToken !== undefined;
            // If we have a user + token AND we're NOT on /login, auth succeeded
            sessionReadyInferred = hasUser && hasToken && window.location.pathname !== '/login';
          }
        } catch {
          // parsing failed — leave as false
        }

        return {
          sessionReady: sessionReadyInferred,
          userPresent: ((): boolean => {
            try {
              const raw = localStorage.getItem('vedmoulya-auth');
              if (!raw) return false;
              const parsed = JSON.parse(raw) as PersistedAuthState;
              return parsed.state?.user !== null && parsed.state?.user !== undefined;
            } catch {
              return false;
            }
          })(),
          pathname: window.location.pathname,
          localStorageAuth: redacted,
        };
      },
    );

    console.warn(
      `[AUTH-DIAG] browser state: pathname=${state.pathname} userPresent=${String(state.userPresent)} sessionReady=${String(state.sessionReady)} localStorage=${state.localStorageAuth}`,
    );

    return state;
  } catch (err) {
    console.warn(`[AUTH-DIAG] browser state capture failed: ${String(err)}`);
    return null;
  }
}
