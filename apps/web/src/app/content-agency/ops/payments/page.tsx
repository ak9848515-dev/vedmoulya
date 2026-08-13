// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Payment Tracking (EPIC-003 / AC-002, Modules 5 & 6)
// Revenue overview, cash flow, outstanding balances and payment recording.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Plus, Wallet, TrendingUp, AlertCircle, CheckCircle2, CalendarDays } from 'lucide-react';
import {
  Card,
  Badge,
  Loading,
  ErrorState,
  Button,
  TextField,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@vedmoulya/ui';
import { AgencySubNav } from '../../_components/AgencySubNav.js';
import { useAgencyPage } from '../../_components/use-agency-page.js';
import { SignInRedirect } from '../../../../components/SignInRedirect.js';
import {
  useOpsPayments,
  useRevenueOverview,
  useAddPayment,
  useContentInvoices,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';

function money(value: number | undefined, currency = 'USD'): string {
  return (value ?? 0).toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}

export default function PaymentsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Payments', '/content-agency/ops/payments');
  const utils = api.useUtils();
  const [recordOpen, setRecordOpen] = useState(false);

  const payments = useOpsPayments(userId);
  const overview = useRevenueOverview(userId);
  const invoices = useContentInvoices(userId);
  const addPayment = useAddPayment();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listPayments.invalidate();
    await utils.clientOps.getRevenueOverview.invalidate();
    await utils.contentAgency.listInvoices.invalidate();
  };

  if (!ready) return <Loading label="Loading payments…" />;
  if (!userId) return <SignInRedirect />;

  const maxCashflow = Math.max(
    1,
    ...(overview.data?.cashflow ?? []).map((c) => Math.max(c.received, c.outstanding)),
  );

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Payments &amp; Revenue
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Invoices, payments, outstanding balances and cash flow.
          </p>
        </div>
        <Button
          onClick={() => {
            setRecordOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Record payment
        </Button>
      </div>

      {overview.isError ? (
        <ErrorState
          title="Could not load revenue"
          onRetry={() => {
            void overview.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Paid"
              value={money(overview.data?.paidTotal, overview.data?.currency)}
              tone="ok"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Outstanding"
              value={money(overview.data?.outstanding, overview.data?.currency)}
              tone={overview.data?.overdueCount ? 'warn' : 'ok'}
            />
            <StatCard
              icon={<AlertCircle className="h-4 w-4" />}
              label="Overdue"
              value={String(overview.data?.overdueCount ?? 0)}
              tone="warn"
            />
            <StatCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Annual revenue"
              value={money(overview.data?.annualRevenue, overview.data?.currency)}
              tone="ok"
            />
          </div>

          <Card variant="elevated" className="p-5">
            <div className="flex items-center justify-between text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
              <span>Cash flow — last 6 months</span>
              <span className="flex items-center gap-3 text-[11.5px] text-[#94A3B8] font-normal">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" /> received
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> outstanding
                </span>
              </span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 h-28">
              {(overview.data?.cashflow ?? []).map((c) => (
                <div key={c.month} className="flex flex-col justify-end items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-20">
                    <div
                      className="w-1/2 max-w-3 rounded-t-md bg-[#10B981]/70"
                      style={{
                        height: `${String(Math.max(4, (c.received / maxCashflow) * 100))}%`,
                      }}
                      title={`Received ${money(c.received)}`}
                    />
                    <div
                      className="w-1/2 max-w-3 rounded-t-md bg-[#F59E0B]/70"
                      style={{
                        height: `${String(Math.max(4, (c.outstanding / maxCashflow) * 100))}%`,
                      }}
                      title={`Outstanding ${money(c.outstanding)}`}
                    />
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">{c.month.slice(2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <div>
        <h2 className="text-[14px] font-bold text-[#111827] dark:text-white mb-3">
          Recent payments
        </h2>
        {payments.isError ? (
          <ErrorState
            title="Could not load payments"
            onRetry={() => {
              void payments.refetch();
            }}
          />
        ) : (
          <Card variant="elevated" className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
            {(payments.data ?? []).map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-[#10B981]/10 dark:bg-[#10B981]/25 flex items-center justify-center text-[#10B981] shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#111827] dark:text-white truncate">
                    {payment.clientName}
                  </div>
                  <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {payment.invoiceNumber} · {payment.method} ·{' '}
                    {new Date(payment.receivedAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge className="bg-[#10B981]/10 text-[#10B981]">
                  +
                  {payment.amount.toLocaleString('en-US', {
                    style: 'currency',
                    currency: payment.currency,
                  })}
                </Badge>
              </div>
            ))}
            {(payments.data ?? []).length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-[#94A3B8]">
                No payments recorded yet
              </div>
            )}
          </Card>
        )}
      </div>

      <RecordPaymentDialog
        open={recordOpen}
        onClose={() => {
          setRecordOpen(false);
        }}
        invoices={invoices.data ?? []}
        onSubmit={async (input) => {
          await addPayment.mutateAsync({ userId, ...input });
          setRecordOpen(false);
          await invalidate();
        }}
      />
    </div>
  );
}

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'ok' | 'warn';
}): React.JSX.Element {
  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        <span className={props.tone === 'warn' ? 'text-[#F59E0B]' : 'text-[#10B981]'}>
          {props.icon}
        </span>
        {props.label}
      </div>
      <div className="mt-2 text-[19px] font-bold font-heading text-[#111827] dark:text-white">
        {props.value}
      </div>
    </Card>
  );
}

function RecordPaymentDialog(props: {
  open: boolean;
  onClose: () => void;
  invoices: Array<{
    id: string;
    clientId: string;
    description: string;
    amount: number;
    status: string;
  }>;
  onSubmit: (input: {
    invoiceId: string;
    amount: number;
    method?: string;
    receivedAt?: string;
    note?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const selected = props.invoices.find((i) => i.id === invoiceId);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select
            label="Invoice *"
            options={props.invoices
              .filter((i) => i.status !== 'paid')
              .map((i) => ({
                value: i.id,
                label: `${i.description || i.id.slice(0, 12)} — ${String(i.amount)} (${i.status})`,
              }))}
            value={invoiceId}
            onChange={(e) => {
              const next = props.invoices.find((i) => i.id === e.target.value);
              setInvoiceId(e.target.value);
              // Pre-fill the amount from the newly selected invoice (the
              // current render's `selected` is still the previous one).
              if (!amount && next) setAmount(String(next.amount));
            }}
            placeholder="Select invoice"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Amount *"
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
            />
            <Select
              label="Method"
              options={['bank_transfer', 'card', 'paypal', 'cash', 'other'].map((m) => ({
                value: m,
                label: m.replace('_', ' '),
              }))}
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
              }}
            />
          </div>
          <TextField
            label="Received date"
            type="date"
            value={receivedAt}
            onChange={(e) => {
              setReceivedAt(e.target.value);
            }}
          />
          {selected && (
            <div className="rounded-xl bg-[#F5F7FA] dark:bg-[#1E293B] p-3 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              Invoice total: <strong>{selected.amount}</strong> · status: {selected.status}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!invoiceId || !amount || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    invoiceId,
                    amount: Number(amount),
                    method,
                    receivedAt,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
