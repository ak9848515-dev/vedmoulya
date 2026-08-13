// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal Shell (EPIC-003 / AC-002, Module 7)
// Standalone layout for the client portal — rendered outside the platform
// AppShell. Guards every page: without a stored token it redirects to login.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Download,
  LogOut,
  Globe2,
  Sparkles,
} from 'lucide-react';
import { Loading } from '@vedmoulya/ui';
import { getPortalToken, clearPortalToken } from '../../../lib/portal-session.js';

const NAV = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/content', label: 'Content', icon: FileText },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/deliverables', label: 'Deliverables', icon: Download },
];

export function PortalShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getPortalToken());
  }, []);

  // eslint-disable-next-line security/detect-possible-timing-attacks -- loading gate on a local state value, not a credential comparison
  if (token === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0F172A]">
        <Loading label="Opening portal…" />
      </div>
    );
  }

  if (!token) {
    router.replace('/portal/login');
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0F172A]">
        <Loading label="Redirecting…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0F172A] flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155] pt-safe">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2B5FD9] to-[#7C3AED] flex items-center justify-center text-white">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-bold font-heading text-[#111827] dark:text-white">
                Client Portal
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                VedMoulya Content Agency
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              clearPortalToken();
              window.location.assign('/portal/login');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#EF4444] transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'border-[#2B5FD9] text-[#2B5FD9] dark:text-[#6B8FEF]'
                    : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-16">{children}</main>

      <footer className="border-t border-[#E2E8F0] dark:border-[#334155] py-4 text-center text-[11.5px] text-[#94A3B8] flex items-center justify-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Powered by the VedMoulya AI Content Agency
      </footer>
    </div>
  );
}
