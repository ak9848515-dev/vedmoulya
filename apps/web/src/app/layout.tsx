// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Root Layout
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from 'next';
import { Providers } from '../components/Providers.js';
import { AppShell } from '../components/AppShell.js';
import './globals.css';

export const metadata: Metadata = {
  title: 'VedMoulya — Life Operating System',
  description:
    'Empower every determined individual to build a sustainable livelihood through knowledge, execution, and intelligent technology.',
  // Icons are intentionally omitted: the app ships its own mobile icons via
  // the Capacitor Android project (adaptive icon) and PWA manifest.
};

// MOB-002 — viewport-fit=cover lets the Capacitor WebView render edge-to-edge
// so `env(safe-area-inset-*)` insets (see globals.css) are populated.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2B5FD9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Font strategy (SPRINT-043B): preconnect to font hosts to reduce
            render-blocking latency. Fonts remain runtime-loaded (Satoshi +
            Inter + JetBrains Mono) per the existing visual system; no new
            font dependency is introduced. */}
        <link
          key="preconnect-cdnfonts"
          rel="preconnect"
          href="https://fonts.cdnfonts.com"
          crossOrigin="anonymous"
        />
        <link
          key="preconnect-gfonts"
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          key="preconnect-gstatic"
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Satoshi font for headings */}
        <link key="font-satoshi" rel="stylesheet" href="https://fonts.cdnfonts.com/css/satoshi" />
        {/* Inter font for body */}
        <link
          key="font-inter"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        />
        {/* JetBrains Mono for code */}
        <link
          key="font-jetbrains-mono"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        {/* Skip-to-content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[#2B5FD9] focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:text-[14px] focus:font-medium"
        >
          Skip to main content
        </a>
        <div id="main-content">
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>
      </body>
    </html>
  );
}
