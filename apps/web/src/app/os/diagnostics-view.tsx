// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Diagnostics view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The diagnostics battery (engine, dependency, contract, repository, pipeline,
// lifecycle, event-flow, ownership, database) plus the definitive
// validatePlatform certification gate.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSDiagnostics, useOSValidate } from '../../lib/api-client.js';
import { Stethoscope, ShieldCheck, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FindingRow } from './components.js';

export function DiagnosticsView({ userId }: { userId: string }): React.JSX.Element {
  const diagnostics = useOSDiagnostics(userId);
  const validation = useOSValidate(userId);

  if (diagnostics.isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Running the diagnostics battery…" size="lg" />
      </div>
    );
  }

  if (diagnostics.isError || !diagnostics.data) {
    return (
      <EmptyState
        icon={<Stethoscope className="h-10 w-10" />}
        title="Diagnostics unavailable"
        description="The OS diagnostics battery could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void diagnostics.refetch() }}
      />
    );
  }

  const report = diagnostics.data;

  return (
    <div className="space-y-6">
      {/* ── Diagnostics summary ────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Stethoscope className="h-4 w-4 text-[#2B5FD9]" />
              Diagnostics Battery
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Engine · dependency · contract · repository · pipeline · lifecycle · event-flow ·
              ownership · database checks.
            </p>
          </div>
          <Badge variant="info" className="text-[11px]">
            health {Math.round(report.healthScore)}/100
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Passed"
            value={report.passed}
            color="#22C55E"
          />
          <SummaryStat
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Warnings"
            value={report.warnings}
            color="#F59E0B"
          />
          <SummaryStat
            icon={<XCircle className="h-4 w-4" />}
            label="Critical"
            value={report.critical}
            color="#EF4444"
          />
          <SummaryStat
            icon={<Stethoscope className="h-4 w-4" />}
            label="Total checks"
            value={report.total}
            color="#2B5FD9"
          />
        </div>
      </Card>

      {/* ── Platform validation gate ───────────────────────────────────── */}
      {validation.data && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
                Platform Validation
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                The definitive certification gate — {validation.data.summary.passed}/
                {validation.data.summary.total} checks passed (score{' '}
                {Math.round(validation.data.summary.score)}/100).
              </p>
            </div>
            <Badge variant={validation.data.valid ? 'success' : 'danger'} className="text-[11px]">
              {validation.data.valid ? 'PLATFORM VALID' : 'PLATFORM INVALID'}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {validation.data.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
              >
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {check.label}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Findings ───────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Findings</h3>
        <p className="text-xs text-slate-400">
          Every diagnostic finding with severity and category.
        </p>
        <div className="mt-4 space-y-2">
          {report.findings.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">
              No findings — the system is clean.
            </p>
          )}
          {report.findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
