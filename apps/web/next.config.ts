// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Next.js Configuration
// Implements BLP-002/D02 Frontend Platform
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-non-literal-fs-filename -- false positive:
   every path is built from process.cwd() plus fixed literals, and nothing here
   is derived from request input. */
import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic development environment (root-cause fix for the identity DB).
//
// Next.js only loads env files from its OWN project directory (apps/web), so a
// `next dev` / `next start` launched directly (`npm run dev`) never sees the
// repository's authoritative development values in the ROOT `.env.local`. The
// identity service then resolved `config.database.url` through
// `requireExternalUrl('IDENTITY_DATABASE_URL', 'postgres://localhost:5432/…')`,
// silently fell back to localhost, and every Google-OAuth user lookup failed
// with a PostgreSQL connection/auth error (28P01) instead of using the
// configured database.
//
// Fix: load the SAME files in the SAME order as the repository's ONE
// authoritative startup strategy (scripts/lib/probes.ts → loadEnvFilesSafe):
//   • development / test → root `.env.local`, then `apps/web/.env.local`
//   • production / staging → NO local file (platform environment only)
// `process.loadEnvFile` never overwrites an already-set key, so precedence is
// shell variables > apps/web/.env.local (loaded by Next first) > root
// `.env.local`. No value is ever logged, and nothing is exposed to the client
// through NEXT_PUBLIC_* — every key stays server-side.
function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'packages', 'core', 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

// `next-env.d.ts` narrows NODE_ENV to a non-nullable union, but next.config is
// also evaluated by tooling that may not set it — cast to keep the runtime
// fallback explicit without tripping no-unnecessary-condition.
const nodeEnv = (process.env.NODE_ENV as string | undefined) ?? 'development';
if (nodeEnv !== 'production' && nodeEnv !== 'staging') {
  const repoRoot = findRepoRoot(process.cwd());
  const envFiles = [join(repoRoot, '.env.local'), join(repoRoot, 'apps', 'web', '.env.local')];
  for (const file of envFiles) {
    try {
      if (existsSync(file) && typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(file);
      }
    } catch {
      // A malformed/absent file must never break the build — `npm run preflight`
      // reports environment problems with an actionable, secret-free message.
    }
  }
}

const nextConfig: NextConfig = {
  // ── Mobile static export (RD-001) ───────────────────────────────────────
  // Set by apps/web/scripts/build-mobile.mjs so the Capacitor WebView can
  // load a self-contained static bundle (server route handlers are moved
  // aside during that build).
  ...(process.env.BUILD_EXPORT === '1' ? { output: 'export' as const } : {}),

  // ── Server Configuration ────────────────────────────────────────────────
  // Only server-side native packages go here — not UI/shared packages.
  // bcrypt is a native module pulled in transitively by @vedmoulya/identity
  // (PasswordService) through the gateway's production identity wiring
  // (SPRINT PR-002A); it must stay external for the Next.js server bundle.
  serverExternalPackages: ['@vedmoulya/core', 'bcrypt', 'esbuild'],
  // ── Transpile monorepo packages ─────────────────────────────────────────
  transpilePackages: [
    '@vedmoulya/ui',
    '@vedmoulya/api',
    '@vedmoulya/shared',
    '@vedmoulya/services',
    // AI runtime — imported by services/api and client-side pages.
    '@vedmoulya/ai',
    // Ecosystem — imported by services/api and client-side pages.
    '@vedmoulya/ecosystem',
    // Voice — imported by services/api (server-side).
    '@vedmoulya/voice',
    // Production gateway persistence wiring (SPRINT PR-002A/B) — the API
    // gateway resolves each engine's production repository through the
    // service module's DI registration, so all five services must be
    // transpiled into the Next.js server bundle.
    '@vedmoulya/identity',
    '@vedmoulya/memory',
    '@vedmoulya/decision',
    '@vedmoulya/execution',
    '@vedmoulya/knowledge',
    // Content Agency module (EPIC-003 / AC-001) — the gateway resolves its
    // production repository through the module DI registration.
    '@vedmoulya/content-agency',
    // Enterprise Capability Registry (EPIC-004 / EI-001) — the marketplace
    // screen consumes capability DTO types through the tRPC client.
    '@vedmoulya/capabilities',
    // Enterprise Provider Registry (EPIC-004 / EI-002) — the provider
    // marketplace screen consumes provider DTO types through the tRPC client.
    '@vedmoulya/providers',
    // Enterprise Context Registry (EPIC-004 / EI-003) — the context explorer
    // screen consumes context DTO types through the tRPC client.
    '@vedmoulya/context',
    // Enterprise Execution Strategy Engine (EPIC-004 / EI-004) — the strategy
    // explorer screen consumes execution strategy DTO types through the tRPC client.
    '@vedmoulya/execution-strategy',
    // Enterprise Execution Orchestrator (EPIC-004 / EI-005) — the execution
    // explorer screen consumes orchestrator DTO types through the tRPC client.
    '@vedmoulya/execution-orchestrator',
    // Enterprise Goal & Task Intelligence Engine (EPIC-004 / EI-006) — the
    // goal explorer screen consumes goal/task DTO types through the tRPC client.
    '@vedmoulya/goals',
    // Enterprise Intelligence Integration Platform (EPIC-004 / EI-006 / INT-001) —
    // the intelligence dashboard screen consumes pipeline DTO types through the tRPC client.
    '@vedmoulya/intelligence',
    // Enterprise Learning Intelligence Platform (EPIC-004 / EI-007) — the learning
    // intelligence dashboard screen consumes learning DTO types through the tRPC client.
    '@vedmoulya/learning-intelligence',
    // Enterprise Brain (EPIC-004 / EI-008) — the enterprise brain dashboard screen
    // consumes decision DTO types through the tRPC client.
    '@vedmoulya/enterprise-brain',
    // Enterprise Knowledge Intelligence Platform (EPIC-004 / EI-009) — the
    // knowledge center screen consumes knowledge DTO types through the tRPC client.
    '@vedmoulya/knowledge-intelligence',
    // Enterprise Memory Intelligence Platform (EPIC-004 / EI-010) — the memory
    // center screen consumes memory DTO types through the tRPC client.
    '@vedmoulya/memory-intelligence',
    // Enterprise Operating System Integration (EPIC-005 / OS-001) — the
    // enterprise OS dashboard screen consumes OS DTO types + pipeline/health
    // data through the tRPC client.
    '@vedmoulya/os-intelligence',
    // AI World Scheduler (EPIC-018) — cadence-driven discovery scheduling
    // consumed by the scheduler router and persistence wiring.
    '@vedmoulya/ai-world-scheduler',
    // Live Intelligence Bridge (EPIC-017) — real-time intelligence loop
    // consumed by the bridge ports and persistence wiring.
    '@vedmoulya/live-intelligence-bridge',
    // Context & Personal Intelligence Fabric (APP-001) — the context fabric
    // explorer screen consumes fabric DTO types + graph/package data through
    // the tRPC client.
    '@vedmoulya/context-fabric',
    // Enterprise RAG Platform (EPIC-005 / AI-RUNTIME-002) — the /rag
    // explorer screen consumes RAG DTO types through the tRPC client.
    '@vedmoulya/rag',
    // Orchestration Fabric (SPRINT-093/094) — work queuing, concurrency
    // control, and provider routing integrated into the API gateway.
    '@vedmoulya/orchestration-fabric',
  ],

  // ── Webpack Configuration ───────────────────────────────────────────────
  webpack: (config: Record<string, unknown>, ctx: { isServer?: boolean }) => {
    // Resolve .js extension imports to .ts/.tsx in monorepo packages
    // ESM imports in @vedmoulya/ui use .js extensions for Node.js compatibility
    const resolve = config.resolve as Record<string, unknown>;
    resolve.extensionAlias = {
      ...(resolve.extensionAlias as Record<string, unknown>),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    // SPRINT-090B — keep esbuild OUT of the server bundle. PreviewService
    // (services/api → gateway bundle) statically imports esbuild; webpack's
    // CJS context detection then pulls node_modules/esbuild/lib/*.d.ts into
    // the graph and fails cold-start compilation of ANY route importing
    // @vedmoulya/api (including /health/ready). Verified by A/B restart:
    // without this hook the ready route fails with `Module parse failed`
    // on main.d.ts; with it the graph compiles. Runtime behavior unchanged.
    if (ctx.isServer) {
      config.externals = [
        ...([] as unknown[]).concat((config.externals ?? []) as unknown[]),
        { esbuild: 'commonjs esbuild' },
      ];
    }
    return config;
  },

  // ── Experimental Features ───────────────────────────────────────────────
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons'],
  },

  // ── Security Headers ─────────────────────────────────────────────────────
  // Implements OWASP-recommended security headers
  // BLP-002/D08 Security Platform
  // HARDENED (2026-08-09):
  //   • 'unsafe-eval' is served ONLY in development — Next.js dev tooling
  //     (fast refresh) requires it; production bundles never eval. Dropping it
  //     from the deployed CSP removes a common CSP-bypass vector.
  //   • Strict-Transport-Security is served only in production — HSTS never
  //     applies to http://localhost, and pinning `preload` during local dev
  //     can lock out plain-HTTP tooling and local network testing.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    const securityHeaders: Array<{ key: string; value: string }> = [
      // X-Frame-Options: Prevent clickjacking
      { key: 'X-Frame-Options', value: 'DENY' },

      // X-Content-Type-Options: Prevent MIME-type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },

      // Referrer-Policy: Control referrer information
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

      // X-XSS-Protection: Legacy XSS filter (deprecated but still used)
      { key: 'X-XSS-Protection', value: '1; mode=block' },
    ];

    // Strict-Transport-Security (HSTS): Enforce HTTPS for 2 years — prod only.
    if (isProduction) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    // Content-Security-Policy: Mitigate XSS and data injection
    // - 'self' for all resources
    // - 'unsafe-inline' for styles (Tailwind generates inline styles) and for
    //   Next.js bootstrap inline scripts (no nonce infrastructure yet)
    // - 'unsafe-eval' only in dev mode (Next.js fast refresh); removed in prod
    // - https: and wss: for external API calls (AI providers, tRPC)
    // - data: and blob: for images, fonts, and media
    // - frame-ancestors 'none' + upgrade-insecure-requests (HTTPS enforcement)
    securityHeaders.push({
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        isProduction
          ? "script-src 'self' 'unsafe-inline'"
          : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        // layout.tsx loads Satoshi (fonts.cdnfonts.com) and Inter /
        // JetBrains Mono (fonts.googleapis.com CSS + fonts.gstatic.com
        // woff2) — the CSS must be permitted in style-src and the font
        // files in font-src or the app silently falls back to system
        // fonts and logs CSP violations in the console.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com https://fonts.cdnfonts.com",
        "connect-src 'self' https: wss:",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        'upgrade-insecure-requests',
      ].join('; '),
    });

    // Permissions-Policy: Restrict browser features
    securityHeaders.push({
      key: 'Permissions-Policy',
      value: ['camera=()', 'microphone=()', 'geolocation=()', 'interest-cohort=()'].join(', '),
    });

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ── Redirects ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/require-await
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // ── Development Settings ─────────────────────────────────────────────────
  devIndicators: false,

  // ── TypeScript ───────────────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: false,
  },

  // ── ESLint ───────────────────────────────────────────────────────────────
  // The project uses a root-level flat ESLint config (eslint.config.js) with
  // typescript-eslint + security plugins. Next.js' built-in ESLint integration
  // expects eslint-config-next (the legacy .eslintrc format); the flat-config
  // plugin is not detected at build time. Lint is run separately via
  // `npm run lint` — skip the in-build pass to avoid the false warning.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
