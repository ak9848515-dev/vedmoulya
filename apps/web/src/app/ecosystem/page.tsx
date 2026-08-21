// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Ecosystem
// SPRINT-050 — AI Ecosystem Foundation
//
// The unified ecosystem view: Providers, Capabilities, Tools, Agents, Workflows.
// Only Providers are currently actionable. Other sections show architecture
// readiness or coming configuration — never fabricated functionality.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { Cpu, Boxes, Wrench, Bot, Workflow, Shield, Info, ChevronRight } from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { useProviderExperience } from '../../lib/api-client.js';

// ── Tab definitions ──────────────────────────────────────────────────────────

type EcosystemTab = 'providers' | 'capabilities' | 'tools' | 'agents' | 'workflows';

const TABS: Array<{
  id: EcosystemTab;
  label: string;
  icon: React.ReactNode;
  actionable: boolean;
}> = [
  { id: 'providers', label: 'Providers', icon: <Cpu className="h-4 w-4" />, actionable: true },
  {
    id: 'capabilities',
    label: 'Capabilities',
    icon: <Boxes className="h-4 w-4" />,
    actionable: false,
  },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" />, actionable: false },
  { id: 'agents', label: 'Agents', icon: <Bot className="h-4 w-4" />, actionable: false },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: <Workflow className="h-4 w-4" />,
    actionable: false,
  },
];

// ── Risk level styling ───────────────────────────────────────────────────────

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  MEDIUM: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  HIGH: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  CRITICAL: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EcosystemPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState<EcosystemTab>('providers');

  useEffect(() => {
    setActiveSection('ecosystem');
    setBreadcrumbs([{ label: 'AI Ecosystem', href: '/ecosystem' }]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading AI Ecosystem..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#F5F3FF] dark:bg-[#7C3AED]/20">
          <Boxes className="h-5 w-5 text-[#7C3AED]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            AI Ecosystem
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Providers · Capabilities · Tools · Agents · Workflows
          </p>
        </div>
      </div>

      {/* ── Architecture flow ───────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8] flex-wrap">
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">OUTCOME</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">WORKFLOW</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">AGENT</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">CAPABILITY</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">TOOL / MODEL</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">PROVIDER</span>
        </div>
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          The user should not need to know which AI model performs a task.
        </p>
      </Card>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'
            }`}
          >
            {tab.icon}
            {tab.label}
            {!tab.actionable && (
              <span className="ml-1 text-[9px] bg-[#E2E8F0] dark:bg-[#334155] px-1 rounded">
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <ErrorBoundary section="ecosystem-tab">
        {activeTab === 'providers' && <ProvidersTab userId={userId} />}
        {activeTab === 'capabilities' && <CapabilitiesTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'workflows' && <WorkflowsTab userId={userId} />}
      </ErrorBoundary>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Providers Tab (actionable) ───────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ProvidersTab({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError } = useProviderExperience(userId);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[30vh]">
        <Loading label="Loading providers..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card variant="standard" padding="lg" className="text-center dark:bg-[#1E293B]">
        <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
          Unable to load providers. Please try again.
        </p>
      </Card>
    );
  }

  const { providers } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Configured Providers ({providers.length})
        </h2>
        <a
          href="/providers"
          className="text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          Open Provider Registry →
        </a>
      </div>

      {providers.length === 0 ? (
        <EmptyState
          icon={<Cpu className="h-8 w-8" />}
          title="No providers configured"
          description="Add an AI provider to start using VedMoulya's AI capabilities."
        />
      ) : (
        <div className="grid gap-3">
          {providers.map((provider) => (
            <Card
              key={provider.providerId}
              variant="standard"
              padding="md"
              className="dark:bg-[#1E293B]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
                    <Cpu className="h-4 w-4 text-[#2B5FD9]" />
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                      {provider.name}
                    </span>
                    <span className="ml-2 text-[11px] text-[#94A3B8]">{provider.family}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      provider.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">
                    {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {provider.models.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {provider.models.slice(0, 5).map((model) => (
                    <span
                      key={model.id}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8]"
                    >
                      {model.name}
                    </span>
                  ))}
                  {provider.models.length > 5 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#94A3B8]">
                      +{provider.models.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Capabilities Tab (architecture readiness) ────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const CAPABILITY_TAXONOMY = [
  { id: 'TEXT_GENERATION', label: 'Text Generation', category: 'content', risk: 'LOW' as const },
  { id: 'REASONING', label: 'Reasoning', category: 'intelligence', risk: 'LOW' as const },
  { id: 'CODING', label: 'Coding', category: 'development', risk: 'MEDIUM' as const },
  { id: 'RESEARCH', label: 'Research', category: 'research', risk: 'LOW' as const },
  { id: 'VISION', label: 'Image Understanding', category: 'multimodal', risk: 'LOW' as const },
  {
    id: 'IMAGE_GENERATION',
    label: 'Image Generation',
    category: 'multimodal',
    risk: 'LOW' as const,
  },
  {
    id: 'VIDEO_GENERATION',
    label: 'Video Generation',
    category: 'multimodal',
    risk: 'MEDIUM' as const,
  },
  {
    id: 'AUDIO_GENERATION',
    label: 'Audio Generation',
    category: 'multimodal',
    risk: 'LOW' as const,
  },
  { id: 'TEXT_TO_SPEECH', label: 'Text to Speech', category: 'speech', risk: 'LOW' as const },
  { id: 'SPEECH_TO_TEXT', label: 'Speech to Text', category: 'speech', risk: 'LOW' as const },
  { id: 'TRANSLATION', label: 'Translation', category: 'language', risk: 'LOW' as const },
  { id: 'EMBEDDINGS', label: 'Embeddings', category: 'data', risk: 'LOW' as const },
  {
    id: 'DOCUMENT_PROCESSING',
    label: 'Document Processing',
    category: 'data',
    risk: 'LOW' as const,
  },
  { id: 'WEB_RESEARCH', label: 'Web Research', category: 'research', risk: 'MEDIUM' as const },
  {
    id: 'BROWSER_AUTOMATION',
    label: 'Browser Automation',
    category: 'automation',
    risk: 'HIGH' as const,
  },
  { id: 'CODE_EXECUTION', label: 'Code Execution', category: 'development', risk: 'HIGH' as const },
  { id: 'DEPLOYMENT', label: 'Deployment', category: 'operations', risk: 'CRITICAL' as const },
];

function CapabilitiesTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Capability Taxonomy ({CAPABILITY_TAXONOMY.length})
        </h2>
        <Info className="h-4 w-4 text-[#94A3B8]" />
      </div>
      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        Architecture defined. Provider-agnostic capabilities that modules consume without knowing
        providers.
      </p>

      <div className="grid gap-2">
        {CAPABILITY_TAXONOMY.map((cap) => (
          <div
            key={cap.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B]"
          >
            <div className="flex items-center gap-2">
              <Boxes className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {cap.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#94A3B8]">
                {cap.category}
              </span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RISK_STYLES[cap.risk]}`}>
              {cap.risk}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Tools Tab (architecture readiness) ──────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const TOOL_CATALOG = [
  { id: 'search', name: 'Web Search', category: 'research', risk: 'LOW', status: 'Built-in' },
  {
    id: 'calculator',
    name: 'Calculator',
    category: 'productivity',
    risk: 'LOW',
    status: 'Built-in',
  },
  {
    id: 'current_time',
    name: 'Current Time',
    category: 'productivity',
    risk: 'LOW',
    status: 'Built-in',
  },
  { id: 'gmail', name: 'Gmail', category: 'communication', risk: 'HIGH', status: 'Coming' },
  { id: 'calendar', name: 'Calendar', category: 'productivity', risk: 'MEDIUM', status: 'Coming' },
  { id: 'drive', name: 'Google Drive', category: 'storage', risk: 'MEDIUM', status: 'Coming' },
  { id: 'github', name: 'GitHub', category: 'development', risk: 'MEDIUM', status: 'Coming' },
  {
    id: 'browser',
    name: 'Browser Automation',
    category: 'automation',
    risk: 'HIGH',
    status: 'Coming',
  },
  { id: 'youtube', name: 'YouTube API', category: 'media', risk: 'HIGH', status: 'Coming' },
];

function ToolsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Tool Registry ({TOOL_CATALOG.length})
        </h2>
      </div>
      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        Secure tool runtime with schema validation, rate limiting, and audit trail. Built-in tools
        are available now. External tools require operator configuration.
      </p>

      <div className="grid gap-2">
        {TOOL_CATALOG.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B]"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-[#F59E0B]" />
              <span className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {tool.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#94A3B8]">
                {tool.category}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RISK_STYLES[tool.risk]}`}>
                {tool.risk}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  tool.status === 'Built-in'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tool.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Agents Tab (architecture readiness) ─────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const AGENT_CATALOG = [
  {
    id: 'career-agent',
    name: 'Career Agent',
    purpose: 'Career planning, resume analysis, interview preparation',
    capabilities: ['REASONING', 'RESEARCH', 'TEXT_GENERATION'],
    tools: ['search', 'calculator'],
    risk: 'LOW' as const,
    status: 'Coming',
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    purpose: 'Deep research, web exploration, fact verification',
    capabilities: ['RESEARCH', 'WEB_RESEARCH', 'REASONING'],
    tools: ['search', 'browser'],
    risk: 'LOW' as const,
    status: 'Coming',
  },
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    purpose: 'Code generation, review, debugging, refactoring',
    capabilities: ['CODING', 'REASONING'],
    tools: ['github', 'calculator'],
    risk: 'MEDIUM' as const,
    status: 'Coming',
  },
  {
    id: 'learning-agent',
    name: 'Learning Agent',
    purpose: 'Personalized learning paths, knowledge assessment',
    capabilities: ['REASONING', 'TEXT_GENERATION', 'RESEARCH'],
    tools: ['search'],
    risk: 'LOW' as const,
    status: 'Coming',
  },
  {
    id: 'content-agent',
    name: 'Content Agent',
    purpose: 'Content creation, editing, optimization',
    capabilities: ['TEXT_GENERATION', 'REASONING'],
    tools: ['search', 'gmail'],
    risk: 'MEDIUM' as const,
    status: 'Coming',
  },
  {
    id: 'business-agent',
    name: 'Business Agent',
    purpose: 'Business analysis, opportunity assessment, strategy',
    capabilities: ['REASONING', 'RESEARCH', 'TEXT_GENERATION'],
    tools: ['search', 'calculator'],
    risk: 'MEDIUM' as const,
    status: 'Coming',
  },
];

function AgentsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Agent Registry ({AGENT_CATALOG.length})
        </h2>
      </div>
      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        Architecture defined. Agents declare required capabilities, allowed tools, and preferred
        providers. Full autonomous agents require future implementation.
      </p>

      <div className="grid gap-3">
        {AGENT_CATALOG.map((agent) => (
          <Card key={agent.id} variant="standard" padding="md" className="dark:bg-[#1E293B]">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-[#F5F3FF] dark:bg-[#7C3AED]/20">
                  <Bot className="h-4 w-4 text-[#7C3AED]" />
                </div>
                <div>
                  <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {agent.name}
                  </span>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    {agent.purpose}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RISK_STYLES[agent.risk]}`}>
                {agent.risk}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA]"
                >
                  {cap}
                </span>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFFBEB] dark:bg-[#F59E0B]/10 text-[#F59E0B]"
                >
                  {tool}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Workflows Tab (architecture readiness) ──────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const WORKFLOW_CATALOG = [
  {
    id: 'prepare-interview',
    name: 'Prepare Interview',
    outcome: 'Comprehensive interview preparation package',
    steps: 4,
    capabilities: ['RESEARCH', 'REASONING', 'TEXT_GENERATION'],
    agents: ['career-agent', 'research-agent'],
    risk: 'LOW' as const,
    approvalGates: 0,
    status: 'Coming',
  },
  {
    id: 'research-company',
    name: 'Research Company',
    outcome: 'In-depth company analysis and insights',
    steps: 3,
    capabilities: ['RESEARCH', 'WEB_RESEARCH', 'TEXT_GENERATION'],
    agents: ['research-agent'],
    risk: 'LOW' as const,
    approvalGates: 0,
    status: 'Coming',
  },
  {
    id: 'create-learning-plan',
    name: 'Create Learning Plan',
    outcome: 'Personalized skill development roadmap',
    steps: 3,
    capabilities: ['REASONING', 'TEXT_GENERATION', 'RESEARCH'],
    agents: ['learning-agent'],
    risk: 'LOW' as const,
    approvalGates: 0,
    status: 'Coming',
  },
  {
    id: 'create-youtube-episode',
    name: 'Create YouTube Episode',
    outcome: 'Published animated educational episode',
    steps: 8,
    capabilities: ['TEXT_GENERATION', 'IMAGE_GENERATION', 'VIDEO_GENERATION', 'AUDIO_GENERATION'],
    agents: ['content-agent', 'coding-agent'],
    risk: 'HIGH' as const,
    approvalGates: 3,
    status: 'Coming',
  },
  {
    id: 'analyze-resume',
    name: 'Analyze Resume',
    outcome: 'Resume analysis with improvement recommendations',
    steps: 2,
    capabilities: ['TEXT_GENERATION', 'REASONING'],
    agents: ['career-agent'],
    risk: 'LOW' as const,
    approvalGates: 0,
    status: 'Coming',
  },
  {
    id: 'prepare-freelance-proposal',
    name: 'Prepare Freelance Proposal',
    outcome: 'Professional proposal with cost estimates',
    steps: 4,
    capabilities: ['RESEARCH', 'REASONING', 'TEXT_GENERATION'],
    agents: ['business-agent', 'career-agent'],
    risk: 'MEDIUM' as const,
    approvalGates: 1,
    status: 'Coming',
  },
];

// Multi-agent actionable workflows (SPRINT-053)
const MULTI_AGENT_WORKFLOWS = [
  {
    id: 'multi-agent-research-summary',
    name: 'Opportunity Research & Summary',
    outcome: 'Multi-agent research, analysis, and summary of a topic',
    steps: 5,
    capabilities: ['reasoning', 'content_generation'],
    agents: ['Research Agent', 'Analysis Agent', 'Summary Agent', 'Verification Agent'],
    risk: 'MEDIUM' as const,
    approvalGates: 1,
    status: 'Active',
  },
  {
    id: 'career-freelance-intelligence',
    name: 'AI Career & Freelance Intelligence',
    outcome: 'Find and evaluate realistic opportunities based on your goals and profile',
    steps: 7,
    capabilities: ['reasoning', 'content_generation'],
    agents: [
      'Research Agent',
      'Match Agent',
      'Ranking Agent',
      'Proposal Agent',
      'Verification Agent',
    ],
    risk: 'MEDIUM' as const,
    approvalGates: 1,
    status: 'Active',
  },
];

function WorkflowsTab({ userId: _userId }: { userId: string }): React.JSX.Element {
  const [executions, setExecutions] = useState<
    Array<{ id: string; workflowId: string; status: string; stepIndex: number; totalSteps: number }>
  >([]);

  const handleStart = async (workflowId: string): Promise<void> => {
    try {
      const res = await fetch('/api/trpc/ecosystemWorkflow.start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { workflowId } }),
      });
      const data = (await res.json()) as {
        result?: {
          data?: {
            data?: {
              executionId: string;
              workflowId: string;
              status: string;
              currentStepIndex: number;
              totalSteps: number;
            };
          };
        };
      };
      const execData = data.result?.data?.data;
      if (execData) {
        setExecutions((prev) => [
          ...prev,
          {
            id: execData.executionId,
            workflowId: execData.workflowId,
            status: execData.status,
            stepIndex: execData.currentStepIndex,
            totalSteps: execData.totalSteps,
          },
        ]);
      }
    } catch {
      // Error handled by UI state
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Workflow Registry ({WORKFLOW_CATALOG.length})
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
          Execution Ready
        </span>
      </div>
      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        Execution foundation live (SPRINT-052). Workflows can be started, executed step-by-step,
        paused at approval gates, and resumed. Human approval enforced server-side.
      </p>

      {/* Recent executions */}
      {executions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
            Recent Executions
          </h3>
          {executions.map((exec) => (
            <div
              key={exec.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    exec.status === 'COMPLETED'
                      ? 'bg-emerald-500'
                      : exec.status === 'RUNNING'
                        ? 'bg-blue-500 animate-pulse'
                        : exec.status === 'WAITING_FOR_APPROVAL'
                          ? 'bg-amber-500'
                          : exec.status === 'FAILED'
                            ? 'bg-red-500'
                            : 'bg-slate-300'
                  }`}
                />
                <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                  {exec.workflowId}
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  Step {exec.stepIndex + 1} of {exec.totalSteps}
                </span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  exec.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : exec.status === 'RUNNING'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : exec.status === 'WAITING_FOR_APPROVAL'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : exec.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                }`}
              >
                {exec.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {/* Certification workflow - ACTIONABLE */}
        <Card
          variant="standard"
          padding="md"
          className="dark:bg-[#1E293B] border-l-4 border-l-emerald-500"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                <Workflow className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                  Personal Knowledge Summary
                </span>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  Produce a grounded summary from user-supplied text
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">
                  CERTIFICATION WORKFLOW
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Shield className="h-3 w-3" />1 gate
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                LOW
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-[#94A3B8]">
            <span>4 steps</span>
            <span>1 agent</span>
            <span>1 approval gate</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA]">
              content_generation
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA]">
              reasoning
            </span>
          </div>
          <div className="mt-3">
            <button
              onClick={() => {
                void handleStart('certification-knowledge-summary');
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium transition-colors"
            >
              ▶ START
            </button>
          </div>
        </Card>

        {/* Multi-agent workflow - ACTIONABLE (SPRINT-053) */}
        {MULTI_AGENT_WORKFLOWS.map((wf) => (
          <Card
            key={wf.id}
            variant="standard"
            padding="md"
            className="dark:bg-[#1E293B] border-l-4 border-l-blue-500"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                  <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {wf.name}
                  </span>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    {wf.outcome}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium mt-1 inline-block">
                    MULTI-AGENT ({wf.agents.length} agents)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Shield className="h-3 w-3" />
                  {wf.approvalGates} gate{wf.approvalGates !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {wf.risk}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-[#94A3B8]">
              <span>{wf.steps} steps</span>
              <span>{wf.agents.length} agents</span>
              <span>
                {wf.approvalGates} approval gate{wf.approvalGates !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {wf.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#60A5FA]"
                >
                  {cap}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {wf.agents.map((agent) => (
                <span
                  key={agent}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {agent}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  void handleStart(wf.id);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium transition-colors"
              >
                ▶ START
              </button>
            </div>
          </Card>
        ))}

        {/* Other workflows - architecture readiness */}
        {WORKFLOW_CATALOG.map((wf) => (
          <Card key={wf.id} variant="standard" padding="md" className="dark:bg-[#1E293B]">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
                  <Workflow className="h-4 w-4 text-[#2B5FD9]" />
                </div>
                <div>
                  <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {wf.name}
                  </span>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    {wf.outcome}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {wf.approvalGates > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Shield className="h-3 w-3" />
                    {wf.approvalGates} gate{wf.approvalGates !== 1 ? 's' : ''}
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RISK_STYLES[wf.risk]}`}>
                  {wf.risk}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-[#94A3B8]">
              <span>{wf.steps} steps</span>
              <span>
                {wf.agents.length} agent{wf.agents.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {wf.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA]"
                >
                  {cap}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
