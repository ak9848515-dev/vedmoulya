// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Detail: Tabs (UX-04)
//
// Overview · Plan · Activity · Result · Advanced over the REAL MissionStatusView.
// The Overview tab also renders the existing production LiveMissionView so every
// live-execution control (pause / resume / cancel / approve / reject, provider
// wait and recovery panels) stays available for active missions.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { LiveMissionView } from '../../autonomous-builder/LiveMissionView.js';
import { MissionOverview } from './MissionOverview.js';
import { MissionPlan } from './MissionPlan.js';
import { MissionActivity } from './MissionActivity.js';
import { MissionResult } from './MissionResult.js';
import { MissionAdvanced } from './MissionAdvanced.js';

export interface MissionDetailTabsProps {
  status: MissionStatusView;
  onStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  loopPending: boolean;
}

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export function MissionDetailTabs({
  status,
  onStart,
  onPause,
  onResume,
  onCancel,
  onApprove,
  onReject,
  loopPending,
}: MissionDetailTabsProps): React.JSX.Element {
  const isTerminal = TERMINAL_STATES.includes(status.state);

  return (
    <Tabs defaultValue="overview" className="space-y-4" data-testid="mission-detail-tabs">
      <TabsList aria-label="Mission detail sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="result">Result</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <MissionOverview
          status={status}
          onStart={onStart}
          onResume={onResume}
          onApprove={onApprove}
          loopPending={loopPending}
          isTerminal={isTerminal}
        />
        <div>
          <h2 className="mb-3 text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Mission controls &amp; live status
          </h2>
          <LiveMissionView
            status={status}
            loopPending={loopPending}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      </TabsContent>

      <TabsContent value="plan">
        <MissionPlan status={status} />
      </TabsContent>

      <TabsContent value="activity">
        <MissionActivity status={status} />
      </TabsContent>

      <TabsContent value="result">
        <MissionResult status={status} />
      </TabsContent>

      <TabsContent value="advanced">
        <MissionAdvanced status={status} />
      </TabsContent>
    </Tabs>
  );
}
