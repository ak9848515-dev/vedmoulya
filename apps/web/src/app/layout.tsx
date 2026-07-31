// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Root Layout
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next';
import { Providers } from '../components/Providers.js';
import { AppShell } from '../components/AppShell.js';
import './globals.css';

export const metadata: Metadata = {
  title: 'VedMoulya — Life Operating System',
  description:
    'Empower every determined individual to build a sustainable livelihood through knowledge, execution, and intelligent technology.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Satoshi font for headings */}
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/satoshi" />
        {/* Inter font for body */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        />
        {/* JetBrains Mono for code */}
        <link
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
