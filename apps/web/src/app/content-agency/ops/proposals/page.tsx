// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proposal Engine (EPIC-003 / AC-002, Module 2)
// AI-generated proposals with version history, status workflow and exports.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import {
  Plus,
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  History,
  FileDown,
  FileText,
} from 'lucide-react';
import {
  Card,
  Badge,
  Loading,
  ErrorState,
  Button,
  TextField,
  Textarea,
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
  useOpsProposals,
  useOpsProposal,
  useCreateProposal,
  useGenerateProposal,
  useSendProposal,
  useAcceptProposal,
  useRejectProposal,
  useProposalExport,
} from '../../../../lib/api-client.js';
import { api } from '../../../../lib/trpc.js';
import type { ProposalDetailDTO } from '@vedmoulya/services';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' },
  sent: { label: 'Sent', cls: 'bg-[#2B5FD9]/10 text-[#2B5FD9]' },
  accepted: { label: 'Accepted', cls: 'bg-[#10B981]/10 text-[#10B981]' },
  rejected: { label: 'Rejected', cls: 'bg-[#EF4444]/10 text-[#EF4444]' },
};

const DRAFT_STYLE = { label: 'Draft', cls: 'bg-[#64748B]/10 text-[#64748B]' };

export default function ProposalsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Proposals', '/content-agency/ops/proposals');
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const proposals = useOpsProposals(userId);
  const detail = useOpsProposal(userId, selectedId ?? '');
  const createProposal = useCreateProposal();
  const generateProposal = useGenerateProposal();
  const sendProposal = useSendProposal();
  const acceptProposal = useAcceptProposal();
  const rejectProposal = useRejectProposal();
  const proposalExport = useProposalExport();

  const invalidate = async (): Promise<void> => {
    await utils.clientOps.listProposals.invalidate();
    await utils.clientOps.getProposal.invalidate();
  };

  if (!ready) return <Loading label="Loading proposals…" />;
  if (!userId) return <SignInRedirect />;

  const download = (data: string, filename: string, mime: string): void => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (
    proposalId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<void> => {
    const exportResult = await proposalExport(userId, proposalId, format);
    if (!exportResult) return;
    const mime = format === 'html' ? 'text/html' : 'text/markdown';
    download(exportResult.data, exportResult.filename, mime);
  };

  return (
    <div className="space-y-5">
      <AgencySubNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#111827] dark:text-white">
            Proposals
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            AI-drafted, versioned, and exportable proposals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ai"
            onClick={() => {
              setGenerateOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4" /> AI generate
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {proposals.isError ? (
        <ErrorState
          title="Could not load proposals"
          onRetry={() => {
            void proposals.refetch();
          }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(proposals.data ?? []).map((proposal) => {
            const style = STATUS_STYLE[proposal.status] ?? DRAFT_STYLE;
            const pricingTotal = proposal.content.pricing.reduce((sum, p) => sum + p.amount, 0);
            return (
              <Card key={proposal.id} variant="elevated" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => {
                        setSelectedId(proposal.id);
                      }}
                      className="text-left text-[14.5px] font-semibold text-[#111827] dark:text-white hover:text-[#2B5FD9] transition-colors"
                    >
                      {proposal.title}
                    </button>
                    <div className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                      {proposal.content.company} · v{proposal.versionCount} ·{' '}
                      {new Date(proposal.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge className={style.cls}>{style.label}</Badge>
                </div>
                {pricingTotal > 0 && (
                  <div className="mt-3 text-[15px] font-bold text-[#111827] dark:text-white">
                    {pricingTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedId(proposal.id);
                    }}
                  >
                    <History className="h-3.5 w-3.5" /> Versions
                  </Button>
                  {proposal.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void sendProposal
                          .mutateAsync({ userId, proposalId: proposal.id })
                          .then(async () => invalidate())
                      }
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  )}
                  {proposal.status === 'sent' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!text-[#10B981]"
                        onClick={() =>
                          void acceptProposal
                            .mutateAsync({ userId, proposalId: proposal.id })
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
                          void rejectProposal
                            .mutateAsync({ userId, proposalId: proposal.id })
                            .then(async () => invalidate())
                        }
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleExport(proposal.id, 'markdown')}
                  >
                    <FileDown className="h-3.5 w-3.5" /> .md
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleExport(proposal.id, 'html')}
                  >
                    <FileDown className="h-3.5 w-3.5" /> .html
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {proposals.data?.length === 0 && !proposals.isLoading && (
        <div className="text-center py-14 text-[13px] text-[#94A3B8]">
          No proposals yet — generate one with AI or start a draft.
        </div>
      )}

      <CreateProposalDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onSubmit={async (input) => {
          await createProposal.mutateAsync({ userId, ...input });
          setCreateOpen(false);
          await invalidate();
        }}
      />

      <GenerateProposalDialog
        open={generateOpen}
        onClose={() => {
          setGenerateOpen(false);
        }}
        onSubmit={async (input) => {
          await generateProposal.mutateAsync({ userId, ...input });
          setGenerateOpen(false);
          await invalidate();
        }}
      />

      {selectedId && (
        <ProposalDetailDialog
          proposal={detail.data}
          loading={detail.isLoading}
          onClose={() => {
            setSelectedId(null);
          }}
          onExport={async (format) => handleExport(selectedId, format)}
        />
      )}
    </div>
  );
}

// ── Create proposal dialog ───────────────────────────────────────────────────

function CreateProposalDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    content: {
      company: string;
      requirements: string;
      scope: string;
      timeline: string;
      deliverables: string[];
      terms: string;
      pricing: Array<{ label: string; amount: number }>;
    };
  }) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [requirements, setRequirements] = useState('');
  const [scope, setScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [terms, setTerms] = useState('');
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
          <DialogTitle>New proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <TextField
            label="Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Q3 Content Retainer"
          />
          <TextField
            label="Company *"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
            }}
          />
          <Textarea
            label="Requirements"
            value={requirements}
            onChange={(e) => {
              setRequirements(e.target.value);
            }}
            rows={3}
          />
          <Textarea
            label="Scope of work"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
            }}
            rows={3}
          />
          <TextField
            label="Timeline"
            value={timeline}
            onChange={(e) => {
              setTimeline(e.target.value);
            }}
            placeholder="3 months"
          />
          <Textarea
            label="Deliverables (one per line)"
            value={deliverables}
            onChange={(e) => {
              setDeliverables(e.target.value);
            }}
            rows={3}
          />
          <Textarea
            label="Terms"
            value={terms}
            onChange={(e) => {
              setTerms(e.target.value);
            }}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !company.trim() || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    title,
                    content: {
                      company,
                      requirements,
                      scope,
                      timeline,
                      deliverables: deliverables
                        .split('\n')
                        .map((d) => d.trim())
                        .filter(Boolean),
                      terms,
                      pricing: [],
                    },
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AI generate dialog ───────────────────────────────────────────────────────

function GenerateProposalDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    company: string;
    industry?: string;
    requirements: string;
    scope?: string;
    timeline?: string;
    deliverables?: string[];
    brandVoice?: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [requirements, setRequirements] = useState('');
  const [scope, setScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#7C3AED]" />
            <DialogTitle>AI proposal</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <TextField
            label="Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Website Redesign Proposal"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Company *"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
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
          <Textarea
            label="Requirements *"
            value={requirements}
            onChange={(e) => {
              setRequirements(e.target.value);
            }}
            rows={3}
            placeholder="What does the client need?"
          />
          <Textarea
            label="Scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
            }}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Timeline"
              value={timeline}
              onChange={(e) => {
                setTimeline(e.target.value);
              }}
            />
            <TextField
              label="Brand voice"
              value={brandVoice}
              onChange={(e) => {
                setBrandVoice(e.target.value);
              }}
            />
          </div>
          <Textarea
            label="Deliverables (one per line)"
            value={deliverables}
            onChange={(e) => {
              setDeliverables(e.target.value);
            }}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            variant="ai"
            disabled={!title.trim() || !company.trim() || !requirements.trim() || busy}
            onClick={() =>
              void (async (): Promise<void> => {
                setBusy(true);
                try {
                  await props.onSubmit({
                    title,
                    company,
                    industry: industry || undefined,
                    requirements,
                    scope: scope || undefined,
                    timeline: timeline || undefined,
                    deliverables: deliverables
                      .split('\n')
                      .map((d) => d.trim())
                      .filter(Boolean),
                    brandVoice: brandVoice || undefined,
                  });
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {busy ? 'Generating…' : 'Generate with AI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Proposal detail dialog ───────────────────────────────────────────────────

function ProposalDetailDialog(props: {
  proposal?: ProposalDetailDTO;
  loading: boolean;
  onClose: () => void;
  onExport: (format: 'markdown' | 'html' | 'pdf' | 'docx') => Promise<void>;
}): React.JSX.Element {
  if (props.loading || !props.proposal) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
      >
        <DialogContent>
          <Loading label="Loading proposal…" />
        </DialogContent>
      </Dialog>
    );
  }
  const proposal = props.proposal;
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
            <FileText className="h-5 w-5 text-[#2B5FD9]" />
            <DialogTitle>{proposal.title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          {proposal.content.document ? (
            <pre className="whitespace-pre-wrap rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] p-4 text-[12.5px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed max-h-72 overflow-y-auto font-sans">
              {proposal.content.document}
            </pre>
          ) : (
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] p-4 space-y-2 text-[13px] text-[#475569] dark:text-[#CBD5E1]">
              <p>
                <strong>Company:</strong> {proposal.content.company}
              </p>
              <p>
                <strong>Requirements:</strong> {proposal.content.requirements}
              </p>
              <p>
                <strong>Scope:</strong> {proposal.content.scope || '—'}
              </p>
              <p>
                <strong>Timeline:</strong> {proposal.content.timeline || '—'}
              </p>
              <p>
                <strong>Deliverables:</strong> {proposal.content.deliverables.join(', ') || '—'}
              </p>
              {proposal.content.pricing.length > 0 && (
                <div>
                  <strong>Pricing:</strong>
                  <ul className="mt-1 space-y-0.5">
                    {proposal.content.pricing.map((p, i) => (
                      <li key={i}>
                        • {p.label}: {p.amount}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <strong>Terms:</strong> {proposal.content.terms || '—'}
              </p>
            </div>
          )}

          <div>
            <div className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              Version history ({proposal.versionCount})
            </div>
            <div className="space-y-1.5">
              {proposal.versions.map((v) => (
                <div
                  key={v.version}
                  className="flex items-center justify-between rounded-lg bg-[#F8FAFC] dark:bg-[#1E293B] px-3 py-2 text-[12.5px]"
                >
                  <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">
                    v{v.version}
                  </span>
                  <span className="text-[#94A3B8]">
                    {v.note ?? 'version'} · {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void props.onExport('markdown')}>
              Export Markdown
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void props.onExport('html')}>
              Export HTML
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled
              title="On the roadmap (server-side renderer)"
            >
              PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled
              title="On the roadmap (server-side renderer)"
            >
              DOCX
            </Button>
          </div>
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
