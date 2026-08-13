// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center Stories
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import {
  MemoryCard,
  ScoreBadge,
  RelationshipRow,
  TimelineRow,
  ConsumerRow,
  LifecycleBadge,
  CompressionBadge,
  RetentionBadge,
} from '../app/memory/components.js';
import type {
  MemoryItemDTO,
  MemoryRelationshipDTO,
  MemoryTimelineEntryDTO,
  MemoryConsumer,
} from '@vedmoulya/memory-intelligence';

const item: MemoryItemDTO = {
  memoryId: 'mem_seed_0001',
  type: 'provider',
  title: 'OpenAI latency improved 40% after batch rollout',
  content:
    'After the batch rollout to the upgraded model tier, provider OpenAI measured a 40% reduction in p95 latency across the reasoning capability, with no accuracy regression.',
  summary: 'Provider OpenAI p95 latency down 40% after batch rollout; no accuracy regression.',
  source: 'execution run #42',
  sourceType: 'execution',
  owner: 'platform',
  relatedGoal: 'goal_seed_0001',
  relatedCapability: 'reasoning',
  relatedProvider: 'provider_openai',
  tags: ['provider', 'latency', 'insight'],
  importance: { score: 0.86, level: 'high', factors: ['Decision-relevant', 'Repeated event'] },
  confidence: {
    score: 0.91,
    level: 'high',
    factors: ['Source execution 0.88', 'Verified citation'],
  },
  usage: {
    totalRetrievals: 37,
    totalConsumers: 2,
    frequency: 3,
    recency: 0.82,
    lastAccessedAt: '2026-08-06T07:00:00.000Z',
  },
  lifecycleStatus: 'active',
  compressionState: 'summarized',
  retentionPolicy: 'long_term',
  expiresAt: '2027-08-06T07:00:00.000Z',
  consumers: [
    {
      consumerId: 'consumer_seed_0001',
      consumerType: 'engine',
      consumerLabel: 'Enterprise Brain · provider_selection',
      usageCount: 18,
      firstUsedAt: '2026-07-22T08:00:00.000Z',
      lastUsedAt: '2026-08-06T06:30:00.000Z',
    },
  ],
  relationships: [
    {
      relationshipId: 'rel_seed_0001',
      type: 'supports',
      sourceId: 'mem_seed_0001',
      sourceTitle: 'OpenAI latency improved 40% after batch rollout',
      targetId: 'mem_seed_0009',
      targetTitle: 'Batch rollout reduced provider latency',
      weight: 0.92,
      actor: 'memory-platform',
      createdAt: '2026-07-25T08:00:00.000Z',
    },
  ],
  citations: [
    {
      citationId: 'cit_seed_0001',
      sourceId: 'exec/run-42',
      sourceTitle: 'Execution run #42 report',
      sourceType: 'execution',
      reference: 'p95 latency series',
      retrievedAt: '2026-07-25T08:00:00.000Z',
      verified: true,
    },
  ],
  audit: [
    {
      auditId: 'aud_seed_0001',
      action: 'captured',
      actor: 'memory-platform',
      note: 'Captured from execution run #42',
      timestamp: '2026-07-25T08:00:00.000Z',
    },
  ],
  createdAt: '2026-07-25T08:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
};

const relationship: MemoryRelationshipDTO = {
  relationshipId: 'rel_story_001',
  type: 'supports',
  sourceId: 'mem_seed_0001',
  sourceTitle: 'OpenAI latency improved 40% after batch rollout',
  targetId: 'mem_seed_0009',
  targetTitle: 'Batch rollout reduced provider latency',
  weight: 0.92,
  actor: 'memory-platform',
  createdAt: '2026-07-25T08:00:00.000Z',
};

const timelineEntry: MemoryTimelineEntryDTO = {
  memoryId: 'mem_seed_0001',
  title: 'OpenAI latency improved 40% after batch rollout',
  action: 'retrieved',
  actor: 'enterprise-brain',
  note: 'Provider selection consultation',
  timestamp: '2026-08-06T06:30:00.000Z',
};

const consumer: MemoryConsumer = {
  consumerId: 'consumer_story_001',
  consumerType: 'engine',
  consumerLabel: 'Enterprise Brain · provider_selection',
  usageCount: 37,
  firstUsedAt: '2026-07-22T08:00:00.000Z',
  lastUsedAt: '2026-08-06T06:30:00.000Z',
};

const meta: Meta<typeof MemoryCard> = {
  title: 'MemoryIntelligence/MemoryCard',
  component: MemoryCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One stored memory: type, lifecycle, compression state, retention policy, importance, confidence, usage, relationships, and citations — everything the Enterprise Memory Platform records for every engine.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof MemoryCard>;

export const Default: Story = {
  args: { item },
};

export const WithActions: Story = {
  args: {
    item,
    actions: (
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="rounded-md bg-[#F97316] px-2 py-1 text-[11px] font-semibold text-white">
          Reinforce
        </span>
      </div>
    ),
  },
};

export const Archived: Story = {
  args: {
    item: {
      ...item,
      lifecycleStatus: 'archived',
      compressionState: 'collapsed',
      title: 'Archived: legacy provider notes',
    },
  },
};

export const FailureMemory: Story = {
  args: {
    item: {
      ...item,
      type: 'failure',
      title: 'Retry storm on provider rate limits',
      summary:
        'Rate-limit retry storm caused 3× cost on the batch job; backoff policy now applied.',
      importance: { score: 0.74, level: 'medium', factors: ['Failure pattern'] },
      lifecycleStatus: 'consolidated',
      compressionState: 'compressed',
      retentionPolicy: 'medium_term',
    },
  },
};

// ── Secondary components ─────────────────────────────────────────────────────

export const ScoreBadges: StoryObj<typeof ScoreBadge> = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <ScoreBadge score={0.86} level="high" label="Importance" />
      <ScoreBadge score={0.6} level="medium" label="Confidence" />
      <ScoreBadge score={0.3} level="low" label="Importance" />
    </div>
  ),
};

export const StateBadges: StoryObj<typeof LifecycleBadge> = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <LifecycleBadge status="captured" />
      <LifecycleBadge status="validated" />
      <LifecycleBadge status="active" />
      <LifecycleBadge status="archived" />
      <LifecycleBadge status="expired" />
      <CompressionBadge state="raw" />
      <CompressionBadge state="compressed" />
      <CompressionBadge state="summarized" />
      <CompressionBadge state="collapsed" />
      <RetentionBadge policy="ephemeral" />
      <RetentionBadge policy="medium_term" />
      <RetentionBadge policy="permanent" />
    </div>
  ),
};

export const RelationshipExplorer: StoryObj<typeof RelationshipRow> = {
  render: () => (
    <div className="space-y-2">
      <RelationshipRow relationship={relationship} />
      <RelationshipRow
        relationship={{
          ...relationship,
          type: 'contradicts',
          sourceTitle: 'Provider latency spike report',
          weight: 0.55,
        }}
      />
      <RelationshipRow
        relationship={{
          ...relationship,
          type: 'supersedes',
          targetTitle: 'Legacy provider benchmark v1',
          weight: 1,
        }}
      />
    </div>
  ),
};

export const TimelineExplorer: StoryObj<typeof TimelineRow> = {
  render: () => (
    <div className="space-y-2">
      <TimelineRow entry={timelineEntry} />
      <TimelineRow
        entry={{
          ...timelineEntry,
          action: 'compressed',
          actor: 'memory-platform',
          note: 'Reduced 1,204 → 240 chars',
        }}
      />
      <TimelineRow
        entry={{
          ...timelineEntry,
          action: 'expired',
          actor: 'memory-platform',
          note: 'Retention TTL reached',
        }}
      />
    </div>
  ),
};

export const ConsumerExplorer: StoryObj<typeof ConsumerRow> = {
  render: () => (
    <div className="space-y-2">
      <ConsumerRow consumer={consumer} />
      <ConsumerRow
        consumer={{
          ...consumer,
          consumerType: 'module',
          consumerLabel: 'Execution Orchestrator · provider selection',
        }}
      />
      <ConsumerRow
        consumer={{ ...consumer, consumerType: 'user', consumerLabel: 'ashok@vedmoulya.dev' }}
      />
    </div>
  ),
};
