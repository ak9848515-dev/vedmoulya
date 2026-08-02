// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mobile (Capacitor) static export build (RD-001)
// Next.js `output: 'export'` cannot include route handlers, so the server-only
// `/api/*` routes are temporarily moved OUTSIDE the app/ directory (Next's
// route discovery scans every subdirectory of app/, so an api.bak sibling would
// still be treated as routes) and restored afterwards. The static bundle (out/)
// is loaded by the Capacitor WebView and talks to the remote gateway via
// NEXT_PUBLIC_GATEWAY_URL.
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const apiDir = resolve(appDir, 'src/app/api');
const backupDir = resolve(appDir, '.api-backup');

process.chdir(appDir);

// Start from a clean slate so stale .next route manifests are never reused.
rmSync(resolve(appDir, '.next'), { recursive: true, force: true });

const moved = existsSync(apiDir);
if (moved) {
  rmSync(backupDir, { recursive: true, force: true });
  mkdirSync(resolve(backupDir, '..'), { recursive: true });
  renameSync(apiDir, backupDir);
  console.log('[mobile] moved src/app/api → .api-backup (outside app/)');
}

try {
  console.log('[mobile] exporting static bundle (output: export)…');
  execSync('npx next build', {
    stdio: 'inherit',
    env: { ...process.env, BUILD_EXPORT: '1' },
  });
  console.log('[mobile] export complete → out/');
} finally {
  if (moved) {
    renameSync(backupDir, apiDir);
    console.log('[mobile] restored src/app/api route handlers');
  }
}
