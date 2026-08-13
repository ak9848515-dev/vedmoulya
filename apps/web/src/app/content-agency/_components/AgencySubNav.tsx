// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Sub-Navigation (EPIC-003 / AC-001)
// Module-level nav shared by every content-agency screen. Renders a
// horizontally scrollable chip row on mobile and a full row on desktop.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Palette,
  FolderKanban,
  CalendarDays,
  Sparkles,
  ClipboardCheck,
  Send,
  Receipt,
  BarChart3,
  Building2,
} from 'lucide-react';
import { cn } from '@vedmoulya/ui';

interface AgencyLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const LINKS: AgencyLink[] = [
  {
    href: '/content-agency',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-3.5 w-3.5" />,
  },
  { href: '/content-agency/clients', label: 'Clients', icon: <Users className="h-3.5 w-3.5" /> },
  { href: '/content-agency/brands', label: 'Brands', icon: <Palette className="h-3.5 w-3.5" /> },
  {
    href: '/content-agency/projects',
    label: 'Projects',
    icon: <FolderKanban className="h-3.5 w-3.5" />,
  },
  {
    href: '/content-agency/calendar',
    label: 'Calendar',
    icon: <CalendarDays className="h-3.5 w-3.5" />,
  },
  {
    href: '/content-agency/generator',
    label: 'Generator',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  {
    href: '/content-agency/review',
    label: 'Review',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  { href: '/content-agency/delivery', label: 'Delivery', icon: <Send className="h-3.5 w-3.5" /> },
  {
    href: '/content-agency/invoices',
    label: 'Invoices',
    icon: <Receipt className="h-3.5 w-3.5" />,
  },
  {
    href: '/content-agency/analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
  },
  { href: '/content-agency/ops', label: 'Operations', icon: <Building2 className="h-3.5 w-3.5" /> },
];

export function AgencySubNav(): React.JSX.Element {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Content Agency"
      className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar"
    >
      {LINKS.map((link) => {
        // Parent match: '/content-agency' matches exactly; children match by prefix.
        const active =
          link.href === '/content-agency'
            ? pathname === '/content-agency'
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200 border',
              active
                ? 'bg-[#2B5FD9] border-[#2B5FD9] text-white shadow-sm shadow-[#2B5FD9]/30'
                : 'bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:border-[#2B5FD9]/50 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF]',
            )}
          >
            {link.icon}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { LINKS as AGENCY_LINKS };
