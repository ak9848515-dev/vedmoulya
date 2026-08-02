// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Next.js Configuration
// Implements BLP-002/D02 Frontend Platform
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── Server Configuration ────────────────────────────────────────────────
  // Only server-side native packages go here — not UI/shared packages.
  // bcrypt is a native module pulled in transitively by @vedmoulya/identity
  // (PasswordService) through the gateway's production identity wiring
  // (SPRINT PR-002A); it must stay external for the Next.js server bundle.
  serverExternalPackages: ['@vedmoulya/core', 'bcrypt'],

  // ── Transpile monorepo packages ─────────────────────────────────────────
  transpilePackages: [
    '@vedmoulya/ui',
    '@vedmoulya/api',
    '@vedmoulya/shared',
    '@vedmoulya/services',
    // Production gateway persistence wiring (SPRINT PR-002A/B) — the API
    // gateway resolves each engine's production repository through the
    // service module's DI registration, so all five services must be
    // transpiled into the Next.js server bundle.
    '@vedmoulya/identity',
    '@vedmoulya/memory',
    '@vedmoulya/decision',
    '@vedmoulya/execution',
    '@vedmoulya/knowledge',
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // X-Frame-Options: Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },

          // X-Content-Type-Options: Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Referrer-Policy: Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // X-XSS-Protection: Legacy XSS filter (deprecated but still used)
          { key: 'X-XSS-Protection', value: '1; mode=block' },

          // Strict-Transport-Security (HSTS): Enforce HTTPS for 2 years
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },

          // Content-Security-Policy: Mitigate XSS and data injection
          // - 'self' for all resources
          // - 'unsafe-inline' for styles (Tailwind generates inline styles)
          //   and for Next.js bootstrap scripts (nonce-based in production)
          // - 'unsafe-eval' needed for Next.js dev mode; can be removed in prod
          // - https: and wss: for external API calls (AI providers, tRPC)
          // - data: and blob: for images, fonts, and media
          // - upgrade-insecure-requests enforces HTTPS alongside HSTS
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              'upgrade-insecure-requests',
            ].join('; '),
          },

          // Permissions-Policy: Restrict browser features
          {
            key: 'Permissions-Policy',
            value: ['camera=()', 'microphone=()', 'geolocation=()', 'interest-cohort=()'].join(
              ', ',
            ),
          },
        ],
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
