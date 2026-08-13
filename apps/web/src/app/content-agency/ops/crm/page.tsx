/* eslint-disable security/detect-object-injection -- Heuristic rule: keys are typed literal unions (Stage/LeadStatus), not user input */
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client CRM (EPIC-003 / AC-002, Module 1)
// Pipeline board: lead → qualified → proposal → negotiation → won/lost,
// with health scores, interaction timeline, tasks and contacts.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import {
  Plus,
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
  CheckCircle2,
  Circle,
  Archive,
  Trash2,
  Building2,
  HeartPulse,
  MessageSquare,
} from 'lucide-react';
import {
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
  useOpsLeads,
  useOpsLead,
  useCreateLead,
  useMoveLead,
  useArchiveLead,
  useAddInteraction,
  useAddTask,
  useCompleteTask,
  useAddContact,
  useDeleteContact,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';
import type { LeadDTO, LeadDetailDTO } from '@vedmoulya/services';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const STAGE_COLOR: Record<Stage, string> = {
  lead: 'bg-[#64748B]',
  qualified: 'bg-[#2B5FD9]',
  proposal: 'bg-[#7C3AED]',
  negotiation: 'bg-[#F59E0B]',
  won: 'bg-[#10B981]',
  lost: 'bg-[#EF4444]',
};

function healthTone(score: number): string {
  if (score >= 70) return 'text-[#10B981] bg-[#10B981]/10';
  if (score >= 40) return 'text-[#F59E0B] bg-[#F59E0B]/10';
  return 'text-[#EF4444] bg-[#EF4444]/10';
}

export default function CrmPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('CRM', '/content-agency/ops/crm');
  const utils = api.useUtils();
  const [filter, setFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const leads = useOpsLeads(userId, filter === 'all' ? undefined : filter);
  const detail = useOpsLead(userId, selectedId ?? '');

  const createLead = useCreateLead();
  const moveLead = useMoveLead();
  const archiveLead = useArchiveLead();
  const addInteraction = useAddInteraction();
  const addTask = useAddTask();
  const completeTask = useCompleteTask();
  const addContact = useAddContact();
  const deleteContact = useDeleteContact();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listLeads.invalidate();
    await utils.clientOps.getLead.invalidate();
  };

  if (!ready) return <Loading label="Loading CRM…" />;
  if (!userId) return <SignInRedirect />;

  const byStage = useMemo(() => {
    const grouped = new Map<Stage, LeadDTO[]>();
    for (const stage of STAGES) grouped.set(stage, []);
    for (const lead of leads.data ?? []) grouped.get(lead.status)?.push(lead);
    return grouped;
  }, [leads.data]);

  const openDetail = (id: string): void => {
    setSelectedId(id);
  };

  const handleMove = async (leadId: string, to: Stage): Promise<void> => {
    await moveLead.mutateAsync({ userId, leadId, to });
    await invalidate();
  };

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Client CRM
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Pipeline, health and follow-ups for every prospect.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add lead
        </Button>
      </div>

      {/* Stage filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(['all', ...STAGES, 'archived'] as const).map((stage) => (
          <button
            key={stage}
            onClick={() => {
              setFilter(stage);
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium border transition-all ${
              filter === stage
                ? 'bg-[#2B5FD9] border-[#2B5FD9] text-white'
                : 'bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:border-[#2B5FD9]/50'
            }`}
          >
            {stage === 'all' ? 'All' : stage === 'archived' ? 'Archived' : STAGE_LABEL[stage]}
          </button>
        ))}
      </div>

      {leads.isError ? (
        <ErrorState
          title="Could not load leads"
          onRetry={() => {
            void leads.refetch();
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const items = byStage.get(stage) ?? [];
            return (
              <div
                key={stage}
                className="rounded-2xl bg-[#F1F5F9] dark:bg-[#161F33] p-2.5 min-h-[140px]"
              >
                <div className="flex items-center justify-between px-1 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${STAGE_COLOR[stage]}`} />
                    <span className="text-[12px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
                      {STAGE_LABEL[stage]}
                    </span>
                  </div>
                  <Badge className="bg-white dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => {
                        openDetail(lead.id);
                      }}
                      className="w-full text-left rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3 transition-all hover:border-[#2B5FD9]/50 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[#111827] dark:text-white truncate">
                            {lead.company}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-[#64748B] dark:text-[#94A3B8] truncate">
                            {lead.contactName || lead.contactEmail || 'No contact yet'}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[10.5px] font-semibold rounded-full px-1.5 py-0.5 ${healthTone(lead.healthScore)}`}
                        >
                          {lead.healthScore}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#94A3B8] dark:text-[#64748B]">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {lead.openTasks} open
                        </span>
                        <span>
                          {lead.value > 0 ? `${lead.currency} ${lead.value.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] p-3 text-center text-[11.5px] text-[#94A3B8]">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create lead dialog */}
      <CreateLeadDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onSubmit={async (input) => {
          await createLead.mutateAsync({ userId, ...input });
          setCreateOpen(false);
          await invalidate();
        }}
      />

      {/* Lead detail dialog */}
      {selectedId && (
        <LeadDetailDialog
          lead={detail.data}
          loading={detail.isLoading}
          onClose={() => {
            setSelectedId(null);
          }}
          onMove={async (to) => {
            await handleMove(selectedId, to);
            await utils.clientOps.getLead.invalidate();
          }}
          onArchive={async () => {
            await archiveLead.mutateAsync({ userId, leadId: selectedId });
            setSelectedId(null);
            await invalidate();
          }}
          onAddInteraction={async (summary, type) => {
            await addInteraction.mutateAsync({
              userId,
              leadId: selectedId,
              summary,
              type: type as 'call' | 'email' | 'meeting' | 'note' | 'proposal' | 'other',
            });
            await utils.clientOps.getLead.invalidate();
          }}
          onAddTask={async (title, dueAt) => {
            await addTask.mutateAsync({ userId, leadId: selectedId, title, dueAt });
            await invalidate();
          }}
          onCompleteTask={async (taskId) => {
            await completeTask.mutateAsync({ userId, leadId: selectedId, taskId });
            await invalidate();
          }}
          onAddContact={async (input) => {
            await addContact.mutateAsync({ userId, leadId: selectedId, ...input });
            await utils.clientOps.getLead.invalidate();
          }}
          onDeleteContact={async (contactId) => {
            await deleteContact.mutateAsync({ userId, leadId: selectedId, contactId });
            await utils.clientOps.getLead.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ── Create lead dialog ───────────────────────────────────────────────────────

function CreateLeadDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    company: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    industry?: string;
    source?: string;
    value?: number;
    nextFollowUp?: string | null;
    notes?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [source, setSource] = useState('manual');
  const [value, setValue] = useState('0');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!company.trim()) return;
    setBusy(true);
    try {
      await props.onSubmit({
        company,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        industry: industry || undefined,
        source: source || undefined,
        value: Number(value) || 0,
        nextFollowUp: nextFollowUp || null,
        notes: notes || undefined,
      });
      setCompany('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setIndustry('');
      setValue('0');
      setNextFollowUp('');
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <TextField
            label="Company *"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
            }}
            placeholder="Acme Inc."
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Contact name"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
              }}
            />
            <TextField
              label="Contact email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Phone"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
              }}
            />
            <TextField
              label="Industry"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Source"
              options={['manual', 'website', 'referral', 'event', 'cold_outreach', 'ad'].map(
                (s) => ({ value: s, label: s.replace('_', ' ') }),
              )}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
              }}
            />
            <TextField
              label="Est. value"
              type="number"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
              }}
            />
          </div>
          <TextField
            label="Next follow-up"
            type="date"
            value={nextFollowUp}
            onChange={(e) => {
              setNextFollowUp(e.target.value);
            }}
          />
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button disabled={!company.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead detail dialog ───────────────────────────────────────────────────────

type Tab = 'timeline' | 'tasks' | 'contacts';

function LeadDetailDialog(props: {
  lead?: LeadDetailDTO;
  loading: boolean;
  onClose: () => void;
  onMove: (to: Stage) => Promise<void>;
  onArchive: () => Promise<void>;
  onAddInteraction: (summary: string, type: string) => Promise<void>;
  onAddTask: (title: string, dueAt: string | null) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onAddContact: (input: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('timeline');
  const [interaction, setInteraction] = useState('');
  const [interactionType, setInteractionType] = useState('note');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>(props.lead?.status ?? 'lead');

  if (props.loading || !props.lead) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <DialogContent>
          <Loading label="Loading lead…" />
        </DialogContent>
      </Dialog>
    );
  }

  const lead = props.lead;

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{lead.company}</DialogTitle>
              <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                {lead.industry || 'Industry unknown'} · {lead.source}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Health + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[12px] font-semibold rounded-full px-2.5 py-1 ${healthTone(lead.healthScore)}`}
            >
              <HeartPulse className="inline h-3.5 w-3.5 mr-1" />
              Health {lead.healthScore}/100
            </span>
            <Badge className="bg-[#2B5FD9]/10 text-[#2B5FD9]">{lead.status}</Badge>
            {lead.clientId && (
              <Badge className="bg-[#10B981]/10 text-[#10B981]">
                Client #{lead.clientId.slice(0, 8)}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Select
                size="md"
                aria-label="Move stage"
                options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
                value={stage}
                onChange={(e) => {
                  const to = e.target.value as Stage;
                  setStage(to);
                  void run(() => props.onMove(to));
                }}
              />
              <Button variant="danger" size="sm" onClick={() => void run(props.onArchive)}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[12.5px] text-[#374151] dark:text-[#E2E8F0]">
            <Info icon={<Mail className="h-3.5 w-3.5" />} value={lead.contactEmail || '—'} />
            <Info icon={<Phone className="h-3.5 w-3.5" />} value={lead.contactPhone || '—'} />
            <Info
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              value={lead.nextFollowUp ? `Follow-up ${lead.nextFollowUp}` : 'No follow-up'}
            />
            <Info icon={<StickyNote className="h-3.5 w-3.5" />} value={lead.notes || 'No notes'} />
          </div>

          {lead.notes && (
            <p className="rounded-xl bg-[#F5F7FA] dark:bg-[#1E293B] p-3 text-[12.5px] text-[#475569] dark:text-[#CBD5E1]">
              {lead.notes}
            </p>
          )}

          {/* Tabs */}
          <div className="flex gap-1.5 border-b border-[#E2E8F0] dark:border-[#334155]">
            {(['timeline', 'tasks', 'contacts'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                }}
                className={`pb-2 px-3 text-[12.5px] font-medium border-b-2 transition-colors capitalize ${
                  tab === t
                    ? 'border-[#2B5FD9] text-[#2B5FD9] dark:text-[#6B8FEF]'
                    : 'border-transparent text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'timeline' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  value={interaction}
                  onChange={(e) => {
                    setInteraction(e.target.value);
                  }}
                  rows={2}
                  placeholder="Log a call, meeting or note…"
                />
                <div className="flex flex-col gap-2">
                  <Select
                    aria-label="Type"
                    options={['call', 'email', 'meeting', 'note', 'proposal', 'other'].map((s) => ({
                      value: s,
                      label: s,
                    }))}
                    value={interactionType}
                    onChange={(e) => {
                      setInteractionType(e.target.value);
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!interaction.trim() || busy}
                    onClick={() =>
                      void run(async () => {
                        await props.onAddInteraction(interaction, interactionType);
                        setInteraction('');
                      })
                    }
                  >
                    Log
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lead.interactions.map((i) => (
                  <div
                    key={i.id}
                    className="flex gap-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] p-3"
                  >
                    <MessageSquare className="h-4 w-4 mt-0.5 text-[#2B5FD9] shrink-0" />
                    <div>
                      <div className="text-[12.5px] text-[#374151] dark:text-[#E2E8F0]">
                        {i.summary}
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">
                        {i.type} · {new Date(i.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {lead.interactions.length === 0 && (
                  <div className="text-center text-[12px] text-[#94A3B8] py-6">
                    No interactions yet
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'tasks' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <TextField
                  value={taskTitle}
                  onChange={(e) => {
                    setTaskTitle(e.target.value);
                  }}
                  placeholder="Follow-up task…"
                />
                <TextField
                  type="date"
                  value={taskDue}
                  onChange={(e) => {
                    setTaskDue(e.target.value);
                  }}
                />
                <Button
                  size="sm"
                  disabled={!taskTitle.trim() || busy}
                  onClick={() =>
                    void run(async () => {
                      await props.onAddTask(taskTitle, taskDue || null);
                      setTaskTitle('');
                      setTaskDue('');
                    })
                  }
                >
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {lead.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] px-3 py-2.5"
                  >
                    <button
                      onClick={() => !t.completed && void run(() => props.onCompleteTask(t.id))}
                      className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#10B981] transition-colors"
                      aria-label={t.completed ? 'Completed' : 'Mark complete'}
                    >
                      {t.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-[13px] ${t.completed ? 'line-through text-[#94A3B8]' : 'text-[#374151] dark:text-[#E2E8F0]'}`}
                    >
                      {t.title}
                    </span>
                    {t.dueAt && <span className="text-[11px] text-[#94A3B8]">{t.dueAt}</span>}
                  </div>
                ))}
                {lead.tasks.length === 0 && (
                  <div className="text-center text-[12px] text-[#94A3B8] py-6">No tasks</div>
                )}
              </div>
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                  }}
                  placeholder="Name *"
                />
                <TextField
                  value={contactEmail}
                  onChange={(e) => {
                    setContactEmail(e.target.value);
                  }}
                  placeholder="Email"
                />
                <TextField
                  value={contactRole}
                  onChange={(e) => {
                    setContactRole(e.target.value);
                  }}
                  placeholder="Role"
                />
                <Button
                  size="sm"
                  disabled={!contactName.trim() || busy}
                  onClick={() =>
                    void run(async () => {
                      await props.onAddContact({
                        name: contactName,
                        email: contactEmail || undefined,
                        role: contactRole || undefined,
                      });
                      setContactName('');
                      setContactEmail('');
                      setContactRole('');
                    })
                  }
                >
                  Add contact
                </Button>
              </div>
              <div className="space-y-2">
                {lead.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] px-3 py-2.5"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 text-[#2B5FD9] flex items-center justify-center text-[12px] font-semibold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#111827] dark:text-white truncate">
                        {c.name}{' '}
                        {c.isPrimary && (
                          <Badge className="ml-1 bg-[#2B5FD9]/10 text-[#2B5FD9]">primary</Badge>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#94A3B8] truncate">
                        {c.email || c.role || '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => void run(() => props.onDeleteContact(c.id))}
                      className="text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                      aria-label="Delete contact"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {lead.contacts.length === 0 && (
                  <div className="text-center text-[12px] text-[#94A3B8] py-6">No contacts yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info(props: { icon: React.ReactNode; value: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-[#94A3B8] shrink-0">{props.icon}</span>
      <span className="truncate">{props.value}</span>
    </span>
  );
}
