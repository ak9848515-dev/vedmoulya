'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Button,
  TextField,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
} from '@vedmoulya/ui';
import { Receipt, Plus, CalendarClock, AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import {
  useContentInvoices,
  useContentClients,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  useAddPayment,
} from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[#F1F5F9] text-[#64748B]' },
  sent: { label: 'Sent', className: 'bg-[#EFF4FE] text-[#1D4ED8]' },
  paid: { label: 'Paid', className: 'bg-[#F0FDF4] text-[#15803D]' },
};
const DEFAULT_STATUS_STYLE = { label: 'Draft', className: 'bg-[#F1F5F9] text-[#64748B]' };

export default function InvoicesPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Invoices', '/content-agency/invoices');
  const invoices = useContentInvoices(userId);
  const clients = useContentClients(userId);
  const create = useCreateInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const addPayment = useAddPayment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', description: '', amount: '', dueDate: '' });

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading invoices..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = invoices.data ?? [];
  const clientOptions = (clients.data ?? []).map((c) => ({ value: c.id, label: c.company }));
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.company]));
  const outstanding = data.filter((i) => i.status === 'sent').reduce((s, i) => s + i.amount, 0);
  const paid = data.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const nowMs = Date.now();
  const overdue = data.filter(
    (i) => i.status === 'sent' && i.dueDate && new Date(i.dueDate).getTime() < nowMs,
  ).length;

  async function handleCreate(): Promise<void> {
    const amount = Number(form.amount);
    if (!form.clientId || !amount || amount < 0) return;
    await create.mutateAsync({
      userId,
      clientId: form.clientId,
      amount,
      description: form.description,
      dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : undefined,
    });
    setForm({ clientId: '', description: '', amount: '', dueDate: '' });
    setOpen(false);
    void invoices.refetch();
  }

  async function handleStatus(id: string, status: 'draft' | 'sent' | 'paid'): Promise<void> {
    if (status === 'paid') {
      // Record a real payment so payments/revenue tracking stay consistent:
      // the addPayment service marks the invoice paid once it is covered.
      // Zero-value / credit invoices (which the payment service rejects) and
      // missing rows fall back to a plain status update.
      const invoice = data.find((i) => i.id === id);
      if (invoice && invoice.amount > 0) {
        await addPayment.mutateAsync({
          userId,
          invoiceId: id,
          amount: invoice.amount,
          method: 'other',
          receivedAt: new Date().toISOString(),
          note: 'Marked paid from invoice screen',
        });
      } else {
        await updateStatus.mutateAsync({ userId, invoiceId: id, status });
      }
    } else {
      await updateStatus.mutateAsync({ userId, invoiceId: id, status });
    }
    void invoices.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              Invoices
            </h1>
            <Badge variant="info" size="sm">
              {data.length} total
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Bill your content clients — draft, send, collect.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Invoice
        </Button>
      </div>

      <AgencySubNav />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="standard" padding="md">
          <p className="text-[12px] text-[#64748B] font-medium">Outstanding</p>
          <p className="text-[22px] font-bold text-[#1D4ED8]">${outstanding.toLocaleString()}</p>
        </Card>
        <Card variant="standard" padding="md">
          <p className="text-[12px] text-[#64748B] font-medium">Collected</p>
          <p className="text-[22px] font-bold text-[#15803D]">${paid.toLocaleString()}</p>
        </Card>
        <Card variant="standard" padding="md">
          <p className="text-[12px] text-[#64748B] font-medium">Overdue</p>
          <p className="text-[22px] font-bold text-[#EF4444]">{overdue}</p>
        </Card>
        <Card variant="standard" padding="md">
          <p className="text-[12px] text-[#64748B] font-medium">Open invoices</p>
          <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
            {data.filter((i) => i.status === 'sent').length}
          </p>
        </Card>
      </div>

      <ErrorBoundary section="content-agency-invoices">
        {invoices.isLoading && !data.length ? (
          <Loading label="Loading invoices..." />
        ) : !data.length ? (
          <Card variant="standard" padding="lg">
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-[#22C55E]" />}
              title="No invoices yet"
              description="Create your first invoice for a client."
              action={{
                label: 'New invoice',
                onClick: () => {
                  setOpen(true);
                },
              }}
            />
          </Card>
        ) : (
          <Card variant="standard" padding="lg">
            <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {data.map((invoice) => {
                const style = STATUS_STYLES[invoice.status] ?? DEFAULT_STATUS_STYLE;
                return (
                  <li key={invoice.id} className="py-3.5 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                        {clientName.get(invoice.clientId) ?? 'Unknown client'}
                        {invoice.description && (
                          <span className="text-[#94A3B8] font-normal">
                            {' '}
                            — {invoice.description}
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">
                        Issued {new Date(invoice.issuedAt).toLocaleDateString()}
                        {invoice.dueDate
                          ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <p className="text-[16px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                      {invoice.currency} {invoice.amount.toLocaleString()}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
                    >
                      {style.label}
                    </span>
                    {invoice.status === 'sent' &&
                      invoice.dueDate &&
                      new Date(invoice.dueDate).getTime() < nowMs && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] dark:bg-[#450A0A] px-2 py-0.5 text-[11px] font-semibold text-[#EF4444]">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      )}
                    {invoice.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleStatus(invoice.id, 'sent')}
                      >
                        Mark sent
                      </Button>
                    )}
                    {invoice.status === 'sent' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleStatus(invoice.id, 'paid')}
                        disabled={addPayment.isPending}
                      >
                        Mark paid
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </ErrorBoundary>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              label="Client"
              options={clientOptions}
              placeholder="Select a client"
              value={form.clientId}
              onChange={(e) => {
                setForm({ ...form, clientId: e.target.value });
              }}
            />
            <TextField
              label="Description"
              placeholder="Monthly retainer — Q3"
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
              }}
            />
            <TextField
              label="Amount (USD)"
              type="number"
              min="0"
              placeholder="2500"
              value={form.amount}
              onChange={(e) => {
                setForm({ ...form, amount: e.target.value });
              }}
            />
            <TextField
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(e) => {
                setForm({ ...form, dueDate: e.target.value });
              }}
            />
            {form.dueDate && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                <CalendarClock className="h-3.5 w-3.5" />
                Overdue tracking activates on this date.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                !form.clientId ||
                !Number(form.amount) ||
                Number(form.amount) < 0 ||
                create.isPending
              }
              onClick={() => void handleCreate()}
            >
              {create.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
