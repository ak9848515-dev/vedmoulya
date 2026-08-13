// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Quotations (EPIC-003 / AC-002, Module 4)
// Packages, discounts, taxes, recurring services with live totals.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Plus, Trash2, BadgeDollarSign, Send, CheckCircle2, XCircle } from 'lucide-react';
import {
  Card,
  Badge,
  Loading,
  ErrorState,
  Button,
  TextField,
  Switch,
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
  useOpsQuotations,
  useCreateQuotation,
  useUpdateQuotation,
  useSendQuotation,
  useAcceptQuotation,
  useRejectQuotation,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' },
  sent: { label: 'Sent', cls: 'bg-[#2B5FD9]/10 text-[#2B5FD9]' },
  accepted: { label: 'Accepted', cls: 'bg-[#10B981]/10 text-[#10B981]' },
  rejected: { label: 'Rejected', cls: 'bg-[#EF4444]/10 text-[#EF4444]' },
};

const DRAFT_STYLE = { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' };

interface PackageRow {
  name: string;
  description?: string;
  price: string;
  qty: string;
}

export default function QuotationsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Quotations', '/content-agency/ops/quotations');
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = useState(false);

  const quotations = useOpsQuotations(userId);
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const sendQuotation = useSendQuotation();
  const acceptQuotation = useAcceptQuotation();
  const rejectQuotation = useRejectQuotation();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listQuotations.invalidate();
  };

  if (!ready) return <Loading label="Loading quotations…" />;
  if (!userId) return <SignInRedirect />;

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Quotations
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Packages, discounts and taxes with live totals.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New quotation
        </Button>
      </div>

      {quotations.isError ? (
        <ErrorState
          title="Could not load quotations"
          onRetry={() => {
            void quotations.refetch();
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(quotations.data ?? []).map((quotation) => {
            const style = STATUS_STYLE[quotation.status] ?? DRAFT_STYLE;
            return (
              <Card key={quotation.id} variant="elevated" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-[#F59E0B]/10 dark:bg-[#F59E0B]/25 flex items-center justify-center text-[#F59E0B] shrink-0">
                      <BadgeDollarSign className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#111827] dark:text-white truncate">
                        {quotation.title}
                      </div>
                      <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                        {quotation.packages.length} package
                        {quotation.packages.length === 1 ? '' : 's'}
                        {quotation.recurring ? ' · recurring' : ''} ·{' '}
                        {new Date(quotation.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge className={style.cls}>{style.label}</Badge>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div className="text-[11.5px] text-[#94A3B8]">
                    Subtotal {quotation.subtotal.toLocaleString()}
                    {quotation.discount > 0 && <div>−{quotation.discount} discount</div>}
                    {quotation.taxRate > 0 && <div>+{quotation.taxRate}% tax</div>}
                  </div>
                  <div className="text-[16px] font-bold text-[#111827] dark:text-white">
                    {quotation.total.toLocaleString('en-US', {
                      style: 'currency',
                      currency: quotation.currency,
                    })}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quotation.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void sendQuotation
                          .mutateAsync({ userId, quotationId: quotation.id })
                          .then(async () => invalidate())
                      }
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  )}
                  {quotation.status === 'sent' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!text-[#10B981]"
                        onClick={() =>
                          void acceptQuotation
                            .mutateAsync({ userId, quotationId: quotation.id })
                            .then(async () => invalidate())
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="!text-[#EF4444]"
                        onClick={() =>
                          void rejectQuotation
                            .mutateAsync({ userId, quotationId: quotation.id })
                            .then(async () => invalidate())
                        }
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {quotation.status === 'sent' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void updateQuotation
                          .mutateAsync({
                            userId,
                            quotationId: quotation.id,
                            discount: quotation.discount,
                            taxRate: quotation.taxRate,
                            recurring: quotation.recurring,
                            packages: quotation.packages.map((p) => ({
                              name: p.name,
                              description: p.description,
                              price: p.price,
                              qty: p.qty,
                            })),
                          })
                          .then(async () => invalidate())
                      }
                    >
                      Recalculate
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateQuotationDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onSubmit={async (input) => {
          await createQuotation.mutateAsync({ userId, ...input });
          setCreateOpen(false);
          await invalidate();
        }}
      />
    </div>
  );
}

function CreateQuotationDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    packages: Array<{ name: string; description?: string; price: number; qty?: number }>;
    discount?: number;
    taxRate?: number;
    recurring?: boolean;
    currency?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<PackageRow[]>([{ name: '', price: '0', qty: '1' }]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);

  const subtotal = rows.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.qty) || 1), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const total = taxable * (1 + (Number(taxRate) || 0) / 100);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New quotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <TextField
            label="Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Launch Package"
          />

          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
              Packages
            </div>
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_80px_70px_36px] gap-2">
                <TextField
                  aria-label="Package name"
                  placeholder="Package name"
                  value={row.name}
                  onChange={(e) => {
                    setRows(rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)));
                  }}
                />
                <TextField
                  aria-label="Price"
                  type="number"
                  placeholder="Price"
                  value={row.price}
                  onChange={(e) => {
                    setRows(
                      rows.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)),
                    );
                  }}
                />
                <TextField
                  aria-label="Qty"
                  type="number"
                  placeholder="Qty"
                  value={row.qty}
                  onChange={(e) => {
                    setRows(rows.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r)));
                  }}
                />
                <button
                  onClick={() => {
                    setRows(rows.filter((_, i) => i !== index));
                  }}
                  className="self-end mb-2 p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                  aria-label="Remove package"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRows([...rows, { name: '', price: '0', qty: '1' }]);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add package
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Discount"
              type="number"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
              }}
            />
            <TextField
              label="Tax rate (%)"
              type="number"
              value={taxRate}
              onChange={(e) => {
                setTaxRate(e.target.value);
              }}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] text-[#374151] dark:text-[#E2E8F0]">
            <Switch checked={recurring} onCheckedChange={setRecurring} />
            Recurring service
          </label>

          <div className="rounded-xl bg-[#F5F7FA] dark:bg-[#1E293B] p-3 space-y-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>−{discount || 0}</span>
            </div>
            <div className="flex justify-between font-semibold text-[#111827] dark:text-white text-[14px]">
              <span>Total</span>
              <span>{total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || rows.every((r) => !r.name.trim()) || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    title,
                    packages: rows
                      .filter((r) => r.name.trim())
                      .map((r) => ({
                        name: r.name,
                        price: Number(r.price) || 0,
                        qty: Number(r.qty) || 1,
                      })),
                    discount: Number(discount) || 0,
                    taxRate: Number(taxRate) || 0,
                    recurring,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Create quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
