// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Contract Management (EPIC-003 / AC-002, Module 3)
// Contracts with versions, approvals, renewals, and expiry tracking.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import {
  Plus,
  FileSignature,
  RefreshCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  Badge,
  Loading,
  ErrorState,
  Button,
  TextField,
  Textarea,
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
  useOpsContracts,
  useOpsExpiringContracts,
  useCreateContract,
  useApproveContract,
  useRenewContract,
  useTerminateContract,
  useContentClients,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';
import type { ContractDTO } from '@vedmoulya/services';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' },
  active: { label: 'Active', cls: 'bg-[#10B981]/10 text-[#10B981]' },
  expired: { label: 'Expired', cls: 'bg-[#EF4444]/10 text-[#EF4444]' },
  terminated: { label: 'Terminated', cls: 'bg-[#64748B]/10 text-[#64748B]' },
};

const DRAFT_STYLE = { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' };

export default function ContractsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Contracts', '/content-agency/ops/contracts');
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [renewing, setRenewing] = useState<ContractDTO | null>(null);

  const contracts = useOpsContracts(userId);
  const expiring = useOpsExpiringContracts(userId, 30);
  const clients = useContentClients(userId);
  const createContract = useCreateContract();
  const approveContract = useApproveContract();
  const renewContract = useRenewContract();
  const terminateContract = useTerminateContract();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listContracts.invalidate();
    await utils.clientOps.listExpiringContracts.invalidate();
  };

  if (!ready) return <Loading label="Loading contracts…" />;
  if (!userId) return <SignInRedirect />;

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Contracts
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Agreements with versions, approvals and renewals.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New contract
        </Button>
      </div>

      {(expiring.data?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[#92400E] dark:text-[#FBBF24]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {expiring.data?.length} contract{expiring.data?.length === 1 ? '' : 's'} expiring within
            30 days: {expiring.data?.map((c) => c.title).join(', ')}
          </span>
        </div>
      )}

      {contracts.isError ? (
        <ErrorState
          title="Could not load contracts"
          onRetry={() => {
            void contracts.refetch();
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(contracts.data ?? []).map((contract) => {
            const style = STATUS_STYLE[contract.status] ?? DRAFT_STYLE;
            return (
              <Card key={contract.id} variant="elevated" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9] shrink-0">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#111827] dark:text-white truncate">
                        {contract.title}
                      </div>
                      <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                        {contract.startDate} → {contract.endDate}
                        {contract.expiresInDays !== null &&
                          contract.expiresInDays <= 30 &&
                          ' · expiring soon'}
                      </div>
                    </div>
                  </div>
                  <Badge className={style.cls}>{style.label}</Badge>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[12.5px] text-[#374151] dark:text-[#E2E8F0]">
                  <span className="font-bold">
                    {contract.value.toLocaleString('en-US', {
                      style: 'currency',
                      currency: contract.currency,
                    })}
                  </span>
                  <span className="text-[#94A3B8]">v{contract.currentVersion}</span>
                  {contract.renewal && (
                    <Badge className="bg-[#7C3AED]/10 text-[#7C3AED]">renewable</Badge>
                  )}
                  {contract.approved && (
                    <Badge className="bg-[#10B981]/10 text-[#10B981]">approved</Badge>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {contract.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void approveContract
                          .mutateAsync({
                            userId,
                            contractId: contract.id,
                            approved: true,
                            by: 'Agency',
                          })
                          .then(async () => invalidate())
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                  {(contract.status === 'active' || contract.status === 'expired') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRenewing(contract);
                      }}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" /> Renew
                    </Button>
                  )}
                  {contract.status !== 'terminated' && contract.status !== 'draft' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!text-[#EF4444]"
                      onClick={() =>
                        void terminateContract
                          .mutateAsync({ userId, contractId: contract.id })
                          .then(async () => invalidate())
                      }
                    >
                      <XCircle className="h-3.5 w-3.5" /> Terminate
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateContractDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        clients={clients.data ?? []}
        onSubmit={async (input) => {
          await createContract.mutateAsync({ userId, ...input });
          setCreateOpen(false);
          await invalidate();
        }}
      />

      {renewing && (
        <RenewContractDialog
          contract={renewing}
          onClose={() => {
            setRenewing(null);
          }}
          onSubmit={async (input) => {
            await renewContract.mutateAsync({ userId, contractId: renewing.id, ...input });
            setRenewing(null);
            await invalidate();
          }}
        />
      )}
    </div>
  );
}

function CreateContractDialog(props: {
  open: boolean;
  onClose: () => void;
  clients: Array<{ id: string; company: string }>;
  onSubmit: (input: {
    clientId: string;
    title: string;
    startDate: string;
    endDate: string;
    value: number;
    currency?: string;
    content?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('0');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select
            label="Client *"
            options={props.clients.map((c) => ({ value: c.id, label: c.company }))}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
            }}
            placeholder="Select client"
          />
          <TextField
            label="Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Annual Retainer"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Start date *"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
            />
            <TextField
              label="End date *"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
              }}
            />
          </div>
          <TextField
            label="Contract value *"
            type="number"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
          />
          <Textarea
            label="Terms content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
            }}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!clientId || !title.trim() || !startDate || !endDate || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    clientId,
                    title,
                    startDate,
                    endDate,
                    value: Number(value) || 0,
                    content: content || undefined,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Create contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewContractDialog(props: {
  contract: ContractDTO;
  onClose: () => void;
  onSubmit: (input: {
    startDate: string;
    endDate: string;
    value?: number;
    note?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [startDate, setStartDate] = useState(props.contract.endDate);
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState(String(props.contract.value));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew “{props.contract.title}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="New start date *"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
            />
            <TextField
              label="New end date *"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
              }}
            />
          </div>
          <TextField
            label="Value"
            type="number"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
          />
          <TextField
            label="Note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!startDate || !endDate || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    startDate,
                    endDate,
                    value: Number(value) || undefined,
                    note: note || undefined,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Renew
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
