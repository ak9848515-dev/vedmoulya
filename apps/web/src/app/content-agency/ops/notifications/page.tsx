// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Operations Notifications (EPIC-003 / AC-002, Module 9)
// Proposal sent, approval pending, invoice due, project completed,
// client comments and contract expirations.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import {
  Bell,
  CheckCheck,
  Mail,
  MailOpen,
  Sparkles,
  AlertTriangle,
  Wallet,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Card, Badge, Loading, ErrorState, Button } from '@vedmoulya/ui';
import { AgencySubNav } from '../../_components/AgencySubNav.js';
import { useAgencyPage } from '../../_components/use-agency-page.js';
import { SignInRedirect } from '../../../../components/SignInRedirect.js';
import {
  useOpsNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';
import type { OpsNotificationDTO } from '@vedmoulya/services';

const TYPE_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  proposal_sent: {
    label: 'Proposal sent',
    cls: 'bg-[#2B5FD9]/10 text-[#2B5FD9]',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  approval_pending: {
    label: 'Approval pending',
    cls: 'bg-[#F59E0B]/10 text-[#F59E0B]',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  invoice_due: {
    label: 'Invoice due',
    cls: 'bg-[#EF4444]/10 text-[#EF4444]',
    icon: <Wallet className="h-3.5 w-3.5" />,
  },
  project_completed: {
    label: 'Project completed',
    cls: 'bg-[#10B981]/10 text-[#10B981]',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  client_comment: {
    label: 'Client comment',
    cls: 'bg-[#7C3AED]/10 text-[#7C3AED]',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  contract_expiring: {
    label: 'Contract expiring',
    cls: 'bg-[#F59E0B]/10 text-[#F59E0B]',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const FALLBACK_META = {
  label: 'Update',
  cls: 'bg-[#2B5FD9]/10 text-[#2B5FD9]',
  icon: <Bell className="h-3.5 w-3.5" />,
};

export default function NotificationsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Notifications', '/content-agency/ops/notifications');
  const utils = api.useUtils();
  const notifications = useOpsNotifications(userId);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listNotifications.invalidate();
  };

  if (!ready) return <Loading label="Loading notifications…" />;
  if (!userId) return <SignInRedirect />;

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  const openNotification = (n: OpsNotificationDTO): void => {
    if (!n.isRead) {
      void markRead.mutateAsync({ userId, notificationId: n.id }).then(async () => invalidate());
    }
    if (n.entityId) {
      const target: Record<string, string> = {
        proposal_sent: '/content-agency/ops/proposals',
        approval_pending: '/content-agency/review',
        invoice_due: '/content-agency/ops/payments',
        project_completed: '/content-agency/projects',
        client_comment: '/content-agency/review',
        contract_expiring: '/content-agency/ops/contracts',
      };
      window.location.assign(target[n.type] ?? '/content-agency/ops');
    }
  };

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Notifications
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            {unread > 0 ? `${String(unread)} unread` : 'All caught up'} · proposals, approvals,
            invoices and client activity.
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="secondary"
            onClick={() => void markAll.mutateAsync({ userId }).then(async () => invalidate())}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.isError ? (
        <ErrorState
          title="Could not load notifications"
          onRetry={() => {
            void notifications.refetch();
          }}
        />
      ) : (
        <Card variant="elevated" className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? FALLBACK_META;
            return (
              <button
                key={n.id}
                onClick={() => {
                  openNotification(n);
                }}
                className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] ${n.isRead ? 'opacity-60' : ''}`}
              >
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] flex items-center justify-center text-[#64748B] dark:text-[#94A3B8] shrink-0">
                  {n.isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[#111827] dark:text-white">
                      {n.title}
                    </span>
                    <Badge className={`${meta.cls} shrink-0`}>
                      <span className="inline-flex items-center gap-1">
                        {meta.icon}
                        {meta.label}
                      </span>
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {n.message}
                  </div>
                  <div className="mt-1 text-[11px] text-[#94A3B8]">
                    {new Date(n.createdAt).toLocaleString()} · audience: {n.audience}
                  </div>
                </div>
                {!n.isRead && <span className="mt-2 h-2 w-2 rounded-full bg-[#2B5FD9] shrink-0" />}
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Bell className="h-8 w-8 text-[#94A3B8]" />
              <div className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
                No notifications yet.
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
