// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory
// EPIC-007 — Phase 20 / EPIC-008 — Phase 3/4. The application-factory
// execution experience. StartPanel collects the goal and produces a plan
// (approval gate); selecting an application opens the full workspace
// (ApplicationWorkspace) with Overview · Specification · Architecture · Plan ·
// Build · Files · Diff · Tests · Security · History · Deployment · Settings.
// Every build is bounded by the EPIC-006 loop budgets; destructive actions and
// deploys require explicit authorization (never silent). No files are
// generated until the plan is approved (Phase 8 preview gate).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Button } from '@vedmoulya/ui';
import {
  Rocket,
  Target,
  User,
  ShieldCheck,
  Scale,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { CapabilityPlanBuilder } from '../../components/capability/CapabilityPlanBuilder.js';
import { useFactoryCreate, useFactoryList } from '../../lib/api-client.js';
import type { FactoryApplicationDTO } from '@vedmoulya/app-factory';
import { ApplicationWorkspace } from './workspace.js';
import ProductBuilder from './builder.js';

const EXAMPLES = [
  {
    id: 'abap',
    label: 'ABAP Debugger Assistant',
    goal: 'Build an ABAP debugger assistant that accepts ABAP source code, performs syntax analysis, explains errors, retrieves SAP knowledge, suggests corrections, and generates validation tests.',
  },
  {
    id: 'restaurant',
    label: 'Modern Restaurant App',
    goal: 'Build a modern restaurant ordering application with a menu, categories, cart, orders, a customer interface, and an admin dashboard — responsive and production quality.',
  },
  {
    id: 'ai-app',
    label: 'AI Application Builder',
    goal: 'Build an AI application that helps users create AI applications: requirements capture, architecture suggestions, capability selection, and guided implementation.',
  },
] as const;

function statusTone(status: string): string {
  switch (status) {
    case 'READY':
    case 'DEPLOYED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
    case 'BUILDING':
    case 'VALIDATING':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
    case 'DRAFT':
    case 'PLANNED':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

// ── Start Panel: goal input + template presets + existing apps ──────────────

function StartPanel({
  userId,
  onCreated,
  onOpen,
}: {
  userId: string;
  onCreated: (applicationId: string) => void;
  onOpen: (applicationId: string) => void;
}): React.JSX.Element {
  const createMutation = useFactoryCreate();
  const list = useFactoryList(userId);
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (): void => {
    if (!goal.trim()) {
      setError('Describe the application you want VedMoulya to build.');
      return;
    }
    setError(null);
    void createMutation
      .mutateAsync({ userId, goal: goal.trim() })
      .then((res) => {
        if (res.data?.applicationId) onCreated(res.data.applicationId);
        else setError('The factory did not return an application id.');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to create the application.');
      });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Describe an application idea
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          VedMoulya will understand the request, identify missing requirements, produce a
          specification, architecture, and execution plan — and show it to you for approval before
          generating any code. The build is bounded by the EPIC-006 loop budgets: generate →
          lint/typecheck/test → critique → refine → security review → UI-quality review → build.
        </p>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
          rows={4}
          value={goal}
          onChange={(e) => {
            setGoal(e.target.value);
          }}
          placeholder='e.g. "Build an ABAP debugger that diagnoses this dump and returns corrected code…"'
        />
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-4 w-4" />
            )}
            Create application project
          </Button>
          <span className="text-[11px] text-slate-400">
            preview first · approved build · isolated workspace
          </span>
        </div>
      </Card>

      <Card className="p-5 dark:bg-[#1E293B]">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Controlled demonstrations
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Three validation projects. The architecture stays generic — these are declarative
          templates, not special-case code.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-[#2B5FD9] hover:bg-[#2B5FD9]/5 dark:border-slate-700"
              onClick={() => {
                setGoal(ex.goal);
              }}
            >
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{ex.label}</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {ex.goal}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {(list.data?.length ?? 0) > 0 && (
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[#2B5FD9]" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Your applications
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {list.data?.map((app) => (
              <button
                key={app.applicationId}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:border-[#2B5FD9] dark:border-slate-700"
                onClick={() => {
                  onOpen(app.applicationId);
                }}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {app.name}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className={`rounded-full px-2 py-0.5 ${statusTone(app.status)}`}>
                    {app.status}
                  </span>
                  <span className="hidden text-slate-400 sm:inline">{app.archetype}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ApplicationsPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  // EPIC-009: the Product Builder (intelligence layer) is the recommended path;
  // EPIC-013: a Capability Plan mode turns the outcome into a capability plan
  // (steps · candidates · automation · approvals) before the factory runs.
  const [mode, setMode] = useState<'intelligence' | 'capability' | 'factory'>('intelligence');

  useEffect(() => {
    setActiveSection('applications');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Application Factory' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Application Factory…
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  // When an application was just created (or opened from the list), the panel
  // seeds with a minimal record and immediately fetches the live status.
  const selected: FactoryApplicationDTO | null = applicationId
    ? {
        applicationId,
        owner: userId,
        name: applicationId,
        archetype: 'generic-web' as const,
        status: 'DRAFT' as const,
        version: '1.0.0',
        technologies: [],
        aiCapabilities: [],
        deploymentStatus: 'not_deployed',
        health: 'unknown',
        fileCount: 0,
        vcOperationCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  return (
    <div className="content-container py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2B5FD9]">
          <Sparkles className="h-4 w-4" />
          EPIC-009 · Product Intelligence & Requirements Engine
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Application Factory
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          First, VedMoulya understands the{' '}
          <strong className="text-slate-600 dark:text-slate-300">problem</strong> behind your idea —
          never the prompt alone. The Product Builder extracts requirements with provenance, asks
          only the questions that matter, proposes safe defaults, plans security and cost, and
          produces a complete product specification for your approval. Only after you approve does
          the Application Factory build it — UNDERSTAND → REQUIREMENTS → PLAN → APPROVE → GENERATE →
          TEST → CRITIQUE → REFINE → BUILD → DEPLOY.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Target className="h-3.5 w-3.5 text-[#2B5FD9]" /> requirements before code
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> security-by-design
          </span>
          <span className="inline-flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-violet-500" /> bounded loop (EPIC-006)
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-[#2B5FD9]" /> persistent, owner-scoped workspace
          </span>
        </div>
        <div className="mt-4 flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/60">
          <button
            onClick={() => {
              setMode('intelligence');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'intelligence'
                ? 'bg-white text-[#2B5FD9] shadow-sm dark:bg-[#1E293B] dark:text-sky-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Product Intelligence
          </button>
          <button
            onClick={() => {
              setMode('capability');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'capability'
                ? 'bg-white text-[#2B5FD9] shadow-sm dark:bg-[#1E293B] dark:text-sky-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Capability Plan
          </button>
          <button
            onClick={() => {
              setMode('factory');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'factory'
                ? 'bg-white text-[#2B5FD9] shadow-sm dark:bg-[#1E293B] dark:text-sky-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Rocket className="h-3.5 w-3.5" />
            Direct Factory
          </button>
        </div>
      </header>

      {applicationId && selected ? (
        <ApplicationWorkspace
          key={applicationId}
          app={selected}
          userId={userId}
          onBack={() => {
            setApplicationId(null);
          }}
          onDeleted={() => {
            setApplicationId(null);
          }}
        />
      ) : mode === 'intelligence' ? (
        <ProductBuilder
          userId={userId}
          onHandedOff={(id) => {
            setApplicationId(id);
          }}
        />
      ) : mode === 'capability' ? (
        <CapabilityPlanBuilder userId={userId} />
      ) : (
        <StartPanel
          userId={userId}
          onCreated={(id) => {
            setApplicationId(id);
          }}
          onOpen={(id) => {
            setApplicationId(id);
          }}
        />
      )}
    </div>
  );
}
