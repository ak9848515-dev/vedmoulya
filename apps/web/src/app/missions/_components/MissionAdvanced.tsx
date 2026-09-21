'use client';

import React from 'react';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { Code2, Eye, Clock, Settings } from 'lucide-react';

interface MissionAdvancedProps {
  status: MissionStatusView;
}

export function MissionAdvanced({ status }: MissionAdvancedProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#64748B]">
        <Settings className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold text-[#111827]">Advanced</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoCard
          title="Mission ID"
          value={status.missionId}
          icon={<Code2 className="h-4 w-4" />}
        />
        <InfoCard title="User ID" value={status.userId} icon={<Eye className="h-4 w-4" />} />
        <InfoCard title="State" value={status.state} icon={<Settings className="h-4 w-4" />} />
        <InfoCard
          title="Autonomy Level"
          value={status.autonomyLevel}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
          Budget Usage
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div>
            <span className="text-[#64748B]">Completed:</span>{' '}
            {status.budgetUsage.objectivesCompleted}
          </div>
          <div>
            <span className="text-[#64748B]">Failed:</span> {status.budgetUsage.objectivesFailed}
          </div>
          <div>
            <span className="text-[#64748B]">Actions:</span> {status.budgetUsage.actionsExecuted}
          </div>
          <div>
            <span className="text-[#64748B]">Tool calls:</span>{' '}
            {status.budgetUsage.toolCallsExecuted}
          </div>
          <div>
            <span className="text-[#64748B]">Retries:</span> {status.budgetUsage.retriesConsumed}
          </div>
          <div>
            <span className="text-[#64748B]">Tokens:</span> {status.budgetUsage.tokensConsumed}
          </div>
          <div>
            <span className="text-[#64748B]">Cost:</span> $
            {status.budgetUsage.costUsdConsumed.toFixed(2)}
          </div>
        </div>
      </div>

      {status.provider && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
            Provider
          </h3>
          <div>
            <span className="text-[#64748B]">Provider:</span>{' '}
            <span className="font-medium">{status.provider}</span>
          </div>
          {status.model && (
            <div className="mt-1">
              <span className="text-[#64748B]">Model:</span>{' '}
              <span className="font-medium">{status.model}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
          Loop Status
        </h3>
        <div className="text-[13px]">
          <span className="text-[#64748B]">Running:</span>{' '}
          <span
            className={`font-medium ${status.loopRunning ? 'text-[#2B5FD9]' : 'text-slate-500'}`}
          >
            {status.loopRunning ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-[#64748B] mb-1">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{title}</span>
      </div>
      <p className="text-[13px] font-mono text-[#111827] break-all">{String(value)}</p>
    </div>
  );
}
