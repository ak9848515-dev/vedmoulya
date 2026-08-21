// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Next.js Configuration
// Implements BLP-002/D02 Frontend Platform
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

import type { NextConfig } from 'next';

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
  ],

  // ── Webpack Configuration ───────────────────────────────────────────────
  webpack: (config: Record<string, unknown>) => {
    // Resolve .js extension imports to .ts/.tsx in monorepo packages
    // ESM imports in @vedmoulya/ui use .js extensions for Node.js compatibility
    const resolve = config.resolve as Record<string, unknown>;
    resolve.extensionAlias = {
      ...(resolve.extensionAlias as Record<string, unknown>),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
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
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
