// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center Stories
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import {
  KnowledgeCard,
  TrustBadge,
  RelationshipRow,
  VersionRow,
  TimelineRow,
  ConsumerRow,
} from '../app/knowledge/components.js';
import type {
  KnowledgeItemDTO,
  KnowledgeRelationshipDTO,
  KnowledgeVersionDTO,
  KnowledgeTimelineEntryDTO,
  KnowledgeConsumer,
} from '@vedmoulya/knowledge-intelligence';

const item: KnowledgeItemDTO = {
  knowledgeId: 'kno_seed_0001',
  title: 'Client onboarding procedure (SAP)',
  description:
    'The authoritative end-to-end client onboarding procedure: SAP master data setup, CRM export reconciliation, and the handoff to the client operations module.',
  source: 'Client onboarding doc v3',
  sourceType: 'document',
  owner: 'client-operations',
  category: 'client',
  tags: ['sap', 'onboarding', 'client'],
  trust: {
    score: 0.86,
    level: 'high',
    factors: ['Source reliability 0.7', 'Validation verified', 'Lifecycle fresh'],
  },
  confidence: {
    score: 0.9,
    level: 'high',
    factors: ['Verified against the last export'],
  },
  version: 3,
  versionHistory: [
    {
      versionId: 'kver_seed_0001_v3',
      knowledgeId: 'kno_seed_0001',
      versionNumber: 3,
      title: 'Client onboarding procedure (SAP)',
      description: 'Added the CRM export reconciliation step.',
      tags: ['sap', 'onboarding', 'client'],
      changeSummary: 'Added reconciliation step',
      actor: 'client-operations',
      createdAt: '2026-08-05T10:00:00.000Z',
    },
  ],
  consumers: [
    {
      consumerId: 'consumer_clientops',
      consumerType: 'module',
      consumerLabel: 'Client Operations · invoice reconciliation',
      usageCount: 42,
      firstUsedAt: '2026-07-20T08:00:00.000Z',
      lastUsedAt: '2026-08-06T07:00:00.000Z',
    },
  ],
  dependencies: [
    {
      dependencyId: 'kdep_seed_0001',
      targetId: 'kno_seed_0012',
      targetTitle: 'SAP field mapping reference',
      type: 'depends_on',
      criticality: 'high',
    },
  ],
  relationships: [
    {
      relationshipId: 'krel_seed_0001',
      type: 'depends_on',
      sourceId: 'kno_seed_0001',
      sourceTitle: 'Client onboarding procedure (SAP)',
      targetId: 'kno_seed_0012',
      targetTitle: 'SAP field mapping reference',
      weight: 0.95,
      actor: 'knowledge-platform',
      createdAt: '2026-07-19T08:00:00.000Z',
    },
    {
      relationshipId: 'krel_seed_0002',
      type: 'consumes',
      sourceId: 'kno_seed_0001',
      sourceTitle: 'Client onboarding procedure (SAP)',
      targetId: 'kno_seed_0008',
      targetTitle: 'Client master data export',
      weight: 0.8,
      actor: 'knowledge-platform',
      createdAt: '2026-07-19T08:00:00.000Z',
    },
  ],
  citations: [
    {
      citationId: 'kcit_seed_0001',
      sourceId: 'doc/onboarding-v3',
      sourceTitle: 'Client onboarding doc v3',
      sourceType: 'document',
      reference: 'Section 2.4 — SAP master data setup',
      retrievedAt: '2026-07-19T08:00:00.000Z',
      verified: true,
    },
  ],
  usage: { totalReads: 128, totalConsumers: 1, lastAccessedAt: '2026-08-06T07:00:00.000Z' },
  validationStatus: 'validated',
  lifecycleStatus: 'active',
  audit: [
    {
      auditId: 'kaud_seed_0001',
      action: 'created',
      actor: 'knowledge-platform',
      note: 'Registered from Client onboarding doc v3',
      timestamp: '2026-07-19T08:00:00.000Z',
    },
  ],
  createdAt: '2026-07-19T08:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
};

const relationship: KnowledgeRelationshipDTO = {
  relationshipId: 'krel_story_001',
  type: 'depends_on',
  sourceId: 'kno_seed_0001',
  sourceTitle: 'Client onboarding procedure (SAP)',
  targetId: 'kno_seed_0012',
  targetTitle: 'SAP field mapping reference',
  weight: 0.95,
  actor: 'knowledge-platform',
  createdAt: '2026-07-19T08:00:00.000Z',
};

const version: KnowledgeVersionDTO = {
  versionId: 'kver_story_001',
  knowledgeId: 'kno_seed_0001',
  versionNumber: 3,
  title: 'Client onboarding procedure (SAP)',
  description: 'Added the CRM export reconciliation step.',
  tags: ['sap', 'onboarding', 'client'],
  changeSummary: 'Added reconciliation step',
  actor: 'client-operations',
  createdAt: '2026-08-05T10:00:00.000Z',
};

const timelineEntry: KnowledgeTimelineEntryDTO = {
  knowledgeId: 'kno_seed_0001',
  title: 'Client onboarding procedure (SAP)',
  action: 'versioned',
  actor: 'client-operations',
  note: 'Added reconciliation step',
  timestamp: '2026-08-05T10:00:00.000Z',
};

const consumer: KnowledgeConsumer = {
  consumerId: 'consumer_story_001',
  consumerType: 'engine',
  consumerLabel: 'Enterprise Brain · provider_selection',
  usageCount: 37,
  firstUsedAt: '2026-07-22T08:00:00.000Z',
  lastUsedAt: '2026-08-06T06:30:00.000Z',
};

const meta: Meta<typeof KnowledgeCard> = {
  title: 'KnowledgeIntelligence/KnowledgeCard',
  component: KnowledgeCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One authoritative knowledge item: category, trust score, lifecycle, validation, citations, consumers, and relationships — everything the Enterprise Knowledge Platform stores for every engine.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof KnowledgeCard>;

export const ActiveValidatedItem: Story = {
  args: { item },
  parameters: {
    docs: {
      description: {
        story: 'An active, validated knowledge item with a high trust score.',
      },
    },
  },
};

export const ItemInReview: Story = {
  args: {
    item: {
      ...item,
      trust: {
        score: 0.52,
        level: 'medium',
        factors: ['Source reliability 0.7', 'Not yet validated'],
      },
      validationStatus: 'pending',
      lifecycleStatus: 'review',
      version: 1,
      consumers: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A freshly captured item awaiting review and validation — never silently relied upon.',
      },
    },
  },
};

export const ItemWithOpenAction: Story = {
  args: {
    item,
    actions: (
      <div className="flex gap-2">
        <button className="rounded-md bg-[#22C55E] px-2.5 py-1 text-[11px] font-semibold text-white">
          Validate
        </button>
        <button className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          Send to review
        </button>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Knowledge card with the Explorer-tab actions row.',
      },
    },
  },
};

export const TrustBadgeStory: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2 p-4">
      <TrustBadge score={0.86} />
      <TrustBadge score={0.52} />
      <TrustBadge score={0.31} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The three trust levels rendered by the Knowledge Platform.',
      },
    },
  },
};

export const RelationshipRowStory: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-4">
      <RelationshipRow relationship={relationship} />
      <RelationshipRow
        relationship={{
          ...relationship,
          type: 'consumes',
          targetTitle: 'Client master data export',
        }}
      />
      <RelationshipRow
        relationship={{
          ...relationship,
          type: 'supersedes',
          targetTitle: 'Onboarding procedure v2',
        }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Knowledge Graph edges — source → type → target.',
      },
    },
  },
};

export const VersionRowStory: Story = {
  render: () => (
    <div className="max-w-lg p-4">
      <VersionRow version={version} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One snapshot in the version history.',
      },
    },
  },
};

export const TimelineRowStory: Story = {
  render: () => (
    <div className="max-w-lg p-4">
      <TimelineRow entry={timelineEntry} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One audit event in the knowledge timeline.',
      },
    },
  },
};

export const ConsumerRowStory: Story = {
  render: () => (
    <div className="max-w-lg p-4">
      <ConsumerRow consumer={consumer} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One consumer of a knowledge item — who uses this knowledge.',
      },
    },
  },
};
