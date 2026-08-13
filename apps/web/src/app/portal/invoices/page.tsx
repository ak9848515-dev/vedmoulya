// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal: Invoices (EPIC-003 / AC-002, Module 7)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { Card, Badge, Loading, ErrorState } from '@vedmoulya/ui';
import { PortalShell } from '../_components/PortalShell.js';
import { getPortalToken } from '../../../lib/portal-session.js';
import { usePortalInvoices } from '../../../lib/api-client.js';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' },
  sent: { label: 'Pending', cls: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  paid: { label: 'Paid', cls: 'bg-[#10B981]/10 text-[#10B981]' },
};

const DRAFT_STYLE = { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' };

function money(value: number | undefined, currency = 'USD'): string {
  return (value ?? 0).toLocaleString('en-US', { style: 'currency', currency });
}

export default function PortalInvoicesPage(): React.JSX.Element | null {
  const [token, setToken] = useState('');
  useEffect(() => {
    setToken(getPortalToken());
  }, []);
  const invoices = usePortalInvoices(token);

  if (!token) return null;

  return (
    <PortalShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Invoices
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            All invoices issued to your company.
          </p>
        </div>

        {invoices.isError ? (
          <ErrorState
            title="Could not load invoices"
            onRetry={() => {
              void invoices.refetch();
            }}
          />
        ) : invoices.isLoading ? (
          <Loading label="Loading invoices…" />
        ) : (invoices.data ?? []).length === 0 ? (
          <Card variant="elevated" className="p-10 text-center text-[13px] text-[#94A3B8]">
            No invoices yet.
          </Card>
        ) : (
          <Card variant="elevated" className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
            {(invoices.data ?? []).map((invoice) => {
              const style = STATUS_STYLE[invoice.status] ?? DRAFT_STYLE;
              const overdue =
                invoice.status === 'sent' &&
                invoice.dueDate &&
                new Date(invoice.dueDate).getTime() < Date.now();
              return (
                <div key={invoice.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9] shrink-0">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-[#111827] dark:text-white truncate">
                      {invoice.description || `Invoice ${invoice.id.slice(0, 8)}`}
                    </div>
                    <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                      {invoice.issuedAt ? `Issued ${invoice.issuedAt}` : 'Draft'}
                      {invoice.dueDate && ` · Due ${invoice.dueDate}`}
                      {overdue && <span className="text-[#EF4444]"> · OVERDUE</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-[#111827] dark:text-white">
                      {money(invoice.amount, invoice.currency)}
                    </div>
                    <Badge className={style.cls}>{style.label}</Badge>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </PortalShell>
  );
}
