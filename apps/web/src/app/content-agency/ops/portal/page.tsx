// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal Access (EPIC-003 / AC-002, Module 7)
// Issue and revoke secure portal access. The raw token is shown once;
// share it with the client together with the /portal URL.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Plus, Globe2, Copy, Check, ShieldOff, KeyRound } from 'lucide-react';
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
  usePortalAccessList,
  useCreatePortalAccess,
  useRevokePortalAccess,
  useContentClients,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';

export default function PortalAccessPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Client Portal', '/content-agency/ops/portal');
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ email: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const accessList = usePortalAccessList(userId);
  const clients = useContentClients(userId);
  const createPortalAccess = useCreatePortalAccess();
  const revokePortalAccess = useRevokePortalAccess();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listPortalAccess.invalidate();
  };

  if (!ready) return <Loading label="Loading portal access…" />;
  if (!userId) return <SignInRedirect />;

  const copyToken = async (): Promise<void> => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.token);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1600);
  };

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Client Portal
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Secure client access to projects, approvals and invoices.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Grant access
        </Button>
      </div>

      <div className="rounded-2xl border border-[#2B5FD9]/25 bg-[#2B5FD9]/5 dark:bg-[#2B5FD9]/10 px-4 py-3 text-[12.5px] text-[#475569] dark:text-[#CBD5E1]">
        <strong className="text-[#2B5FD9]">How it works:</strong> grant access for a client and
        email address, then share the{' '}
        <code className="rounded bg-white dark:bg-[#1E293B] px-1.5 py-0.5 text-[11.5px]">
          /portal
        </code>{' '}
        link with the one-time access token. Tokens are stored hashed (SHA-256) and can be revoked
        anytime.
      </div>

      {accessList.isError ? (
        <ErrorState
          title="Could not load portal access"
          onRetry={() => {
            void accessList.refetch();
          }}
        />
      ) : (
        <Card variant="elevated" className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
          {(accessList.data ?? []).map((access) => (
            <div key={access.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9] shrink-0">
                <Globe2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#111827] dark:text-white truncate">
                  {access.email}
                </div>
                <div className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                  Client {access.clientId.slice(0, 8)} ·{' '}
                  {access.lastLoginAt
                    ? `last login ${new Date(access.lastLoginAt).toLocaleDateString()}`
                    : 'never signed in'}
                </div>
              </div>
              <Badge
                className={
                  access.enabled
                    ? 'bg-[#10B981]/10 text-[#10B981]'
                    : 'bg-[#64748B]/10 text-[#64748B]'
                }
              >
                {access.enabled ? 'active' : 'disabled'}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="!text-[#EF4444]"
                onClick={() =>
                  void revokePortalAccess
                    .mutateAsync({ userId, accessId: access.id })
                    .then(async () => invalidate())
                }
              >
                <ShieldOff className="h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          ))}
          {(accessList.data ?? []).length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-[#94A3B8]">
              No portal access granted yet.
            </div>
          )}
        </Card>
      )}

      <GrantAccessDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        clients={clients.data ?? []}
        onSubmit={async (input) => {
          const result = await createPortalAccess.mutateAsync({ userId, ...input });
          setCreateOpen(false);
          await invalidate();
          const data = result.data as
            { access?: { email?: string }; rawToken?: string } | undefined;
          if (data?.rawToken) {
            setRevealed({ email: data.access?.email ?? input.email, token: data.rawToken });
            setCopied(false);
          }
        }}
      />

      {revealed && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setRevealed(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#10B981]" />
                <DialogTitle>Portal access for {revealed.email}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] p-4">
                <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-1.5">
                  One-time token — copy it now
                </div>
                <code className="block break-all rounded-lg bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] p-3 text-[12.5px] text-[#111827] dark:text-white font-mono">
                  {revealed.token}
                </code>
              </div>
              <div className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                Share this with the client together with the portal link:{' '}
                <code className="rounded bg-[#F1F5F9] dark:bg-[#1E293B] px-1.5 py-0.5 text-[11.5px]">
                  {`${window.location.origin}/portal`}
                </code>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => void copyToken()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy token'}
              </Button>
              <Button
                onClick={() => {
                  setRevealed(null);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function GrantAccessDialog(props: {
  open: boolean;
  onClose: () => void;
  clients: Array<{ id: string; company: string }>;
  onSubmit: (input: { clientId: string; email: string }) => Promise<unknown>;
}): React.JSX.Element {
  const [clientId, setClientId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant portal access</DialogTitle>
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
            label="Client email *"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            placeholder="client@company.com"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!clientId || !email.trim() || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({ clientId, email: email.trim() });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {busy ? 'Generating…' : 'Generate access token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
