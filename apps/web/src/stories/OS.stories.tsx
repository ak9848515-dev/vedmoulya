// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System Stories
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import {
  StatusBadge,
  StageBadge,
  SeverityBadge,
  ScoreGauge,
  EngineRow,
  StageRow,
  FindingRow,
  SnapshotRow,
} from '../app/os/components.js';
import type {
  OSDiagnosticFinding,
  OSEngineStatus,
  OSHealthSnapshot,
  OSPipelineStage,
} from '@vedmoulya/os-intelligence';

const engine: OSEngineStatus = {
  engine: 'goals',
  name: 'Enterprise Goal & Task Intelligence Engine',
  packageName: '@vedmoulya/goals',
  sprint: 'EI-006',
  status: 'healthy',
  latencyMs: 12,
  consulted: true,
  dataSummary: '5 goals · 3 tasks',
  totals: { goals: 5, tasks: 3 },
  lastCheckedAt: '2026-08-06T12:00:00.000Z',
};

const degradedEngine: OSEngineStatus = {
  ...engine,
  engine: 'learning',
  name: 'Enterprise Learning Intelligence Platform',
  packageName: '@vedmoulya/learning-intelligence',
  sprint: 'EI-007',
  status: 'degraded',
  latencyMs: 248,
  dataSummary: '54 events · 12 models',
  totals: { events: 54, models: 12 },
};

const stage: OSPipelineStage = {
  stage: 'decision',
  engine: 'brain',
  label: 'Decision',
  status: 'passed',
  latencyMs: 34,
  detail: '14 decisions · 1 plan · confidence 0.88',
};

const notStartedStage: OSPipelineStage = {
  stage: 'execution_session',
  engine: 'orchestrator',
  label: 'Execution Session',
  status: 'not_started',
  latencyMs: 0,
  detail: 'no active sessions',
};

const finding: OSDiagnosticFinding = {
  id: 'diag_demo_001',
  severity: 'warning',
  category: 'pipeline',
  engine: 'orchestrator',
  message: 'Execution session stage is not started — sessions are created on demand.',
};

const snapshot: OSHealthSnapshot = {
  snapshotId: 'snapshot_os_demo_001',
  checkedAt: '2026-08-06T12:00:00.000Z',
  overallScore: 96,
  status: 'healthy',
  engineCount: 11,
  healthyCount: 11,
  degradedCount: 0,
  unhealthyCount: 0,
  unknownCount: 0,
  pipelineStatus: 'ready',
  pipelineValid: true,
  dependencyAcyclic: true,
  criticalFindings: 0,
  warningFindings: 1,
  passedChecks: 34,
};

const meta: Meta<typeof ScoreGauge> = {
  title: 'OperatingSystem/ScoreGauge',
  component: ScoreGauge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The overall OS health gauge — engines, dependencies, pipeline and diagnostics rolled into one 0-100 score (the health score the Operating System certifies against).',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ScoreGauge>;

export const Healthy: Story = {
  args: { score: 96, status: 'healthy' },
};

export const Degraded: Story = {
  args: { score: 71, status: 'degraded' },
};

export const Unhealthy: Story = {
  args: { score: 43, status: 'unhealthy' },
};

export const StatusBadgeStory: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2 p-4">
      <StatusBadge status="healthy" />
      <StatusBadge status="degraded" />
      <StatusBadge status="unhealthy" />
      <StatusBadge status="unknown" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The four engine health statuses rendered by the OS dashboard.',
      },
    },
  },
};

export const StageBadgeStory: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2 p-4">
      <StageBadge status="passed" />
      <StageBadge status="not_started" />
      <StageBadge status="failed" />
      <StageBadge status="skipped" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The four pipeline-stage statuses of the 15-stage event flow.',
      },
    },
  },
};

export const SeverityBadgeStory: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2 p-4">
      <SeverityBadge severity="info" />
      <SeverityBadge severity="warning" />
      <SeverityBadge severity="critical" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The three diagnostic severity levels of the diagnostics battery.',
      },
    },
  },
};

export const EngineRowStory: Story = {
  render: () => (
    <div className="max-w-2xl space-y-2 p-4">
      <EngineRow engine={engine} />
      <EngineRow engine={degradedEngine} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'One engine status row: sprint badge, engine name, measured latency and data summary.',
      },
    },
  },
};

export const StageRowStory: Story = {
  render: () => (
    <div className="max-w-2xl space-y-2 p-4">
      <StageRow stage={stage} index={8} />
      <StageRow stage={notStartedStage} index={11} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One pipeline stage row in the 15-stage event-flow visualization.',
      },
    },
  },
};

export const FindingRowStory: Story = {
  render: () => (
    <div className="max-w-2xl p-4">
      <FindingRow finding={finding} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One diagnostic finding: severity badge, category and message.',
      },
    },
  },
};

export const SnapshotRowStory: Story = {
  render: () => (
    <div className="max-w-2xl p-4">
      <SnapshotRow snapshot={snapshot} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'One persisted health snapshot: score, engine health counts, pipeline status and diagnostics.',
      },
    },
  },
};
