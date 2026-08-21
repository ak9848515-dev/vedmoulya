// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — web launcher for production `next build` / `next start`
// SPRINT-044 D3 fix — NODE_ENV injection:
//   Next.js only defaults NODE_ENV to 'production' when it is NOT already set.
//   A shell that exports NODE_ENV=development (e.g. one that sources the
//   repo-root `.env.local`, which sets NODE_ENV=development for `next dev`)
//   previously made `next build` prerender the internal /404 and /500 error
//   pages in development mode and fail with:
//     "<Html> should not be imported outside of pages/_document"
//   This launcher forces NODE_ENV=production so the production build/start is
//   deterministic regardless of the invoking environment (cmd.exe + bash, no
//   dependency added). `next dev` intentionally keeps NODE_ENV=development.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const mode = process.argv[2]; // 'build' | 'start'
if (mode !== 'build' && mode !== 'start') {
  console.error('usage: node scripts/run-next.mjs <build|start> [next-args...]');
  process.exit(2);
}

process.env.NODE_ENV = 'production';
const require = createRequire(`${process.cwd()}/`);
const nextBin = require.resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextBin, mode, ...process.argv.slice(3)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
