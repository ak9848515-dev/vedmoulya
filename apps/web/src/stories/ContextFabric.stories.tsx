// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric Stories
// APP-001 — Post-V1 Application Platform Layer
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import {
  EntityCard,
  RelationshipRow,
  ScoreBadge,
  PermissionBadge,
  ProvenanceLine,
  ExplanationList,
  PermissionEvaluationBanner,
} from '../app/context-fabric/components.js';
import type {
  ContextEntity,
  ContextExplanation,
  ContextRelationship,
  PermissionEvaluation,
} from '@vedmoulya/context-fabric';

const now = '2026-08-07T09:00:00.000Z';

function entity(
  overrides: Partial<ContextEntity> & { entityId: string; label: string },
): ContextEntity {
  return {
    graph: 'personal',
    type: 'goal',
    ownerId: 'user_001',
    tags: ['enterprise', 'platform'],
    confidence: 0.92,
    lifecycle: 'active',
    source: 'goal',
    provenance: {
      source: 'goal',
      sourceId: 'goal_blog_seed',
      createdAt: now,
      updatedAt: now,
      producedBy: 'goals-engine',
      reason: 'imported from the active goal registry',
      confidence: 0.92,
    },
    permissions: {
      owner: 'user_001',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: now,
    },
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const goal = entity({
  entityId: 'personal:goal:goal_blog_seed',
  label: 'Launch the VedMoulya blog engine',
  description:
    'Ship a content engine that publishes daily enterprise AI insights using the content-agency pipeline and quality gates.',
});

const restrictedEntity: ContextEntity = {
  ...goal,
  entityId: 'personal:document:foreign',
  label: 'Confidential client brief',
  description: 'Contains non-public pricing and contract terms for a client.',
  type: 'document',
  permissions: {
    owner: 'user_other',
    scope: 'private',
    allowedUsers: [],
    allowedRoles: [],
    capability: [],
    grantedAt: now,
  },
};

const orgEntity: ContextEntity = {
  ...goal,
  graph: 'business',
  entityId: 'business:team:platform',
  label: 'Platform Engineering',
  description: 'Owns the core platform, enterprise intelligence engines and certification gates.',
  type: 'team',
  organizationId: 'org_vedmoulya',
  permissions: {
    owner: 'user_001',
    scope: 'organization',
    allowedUsers: [],
    allowedRoles: ['admin', 'member'],
    capability: [],
    organizationId: 'org_vedmoulya',
    grantedAt: now,
  },
};

const relationship: ContextRelationship = {
  relationshipId: 'rel_u_owns_g1',
  fromId: 'personal:user:me',
  toId: 'personal:goal:goal_blog_seed',
  type: 'owns',
  weight: 1,
  confidence: 0.98,
  source: 'inference',
  provenance: {
    source: 'inference',
    sourceId: 'personal:user:me→personal:goal:goal_blog_seed',
    createdAt: now,
    updatedAt: now,
    producedBy: 'fabric',
    confidence: 0.98,
  },
  createdAt: now,
  metadata: {},
};

const explanations: ContextExplanation[] = [
  {
    entityId: goal.entityId,
    entityLabel: goal.label,
    selected: true,
    score: 0.91,
    reasons: [
      'directly related to the current goal',
      'belongs to the current project',
      'recently updated',
      'you have access',
    ],
  },
  {
    entityId: restrictedEntity.entityId,
    entityLabel: restrictedEntity.label,
    selected: false,
    score: 0.3,
    reasons: ['matches keyword', 'you do NOT have permission to access this context'],
  },
];

const allowed: PermissionEvaluation = {
  entityId: goal.entityId,
  allowed: true,
  reasons: ['you are the owner of this context'],
};

const denied: PermissionEvaluation = {
  entityId: restrictedEntity.entityId,
  allowed: false,
  reasons: ['this context is private and you are not the owner'],
};

const meta = {
  title: 'ContextFabric/Components',
  component: EntityCard,
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

export const EntityCardNormal: StoryObj = {
  render: () => <EntityCard entity={goal} score={0.91} />,
};

export const EntityCardBusiness: StoryObj = {
  render: () => <EntityCard entity={orgEntity} score={0.86} />,
};

export const EntityCardRestricted: StoryObj = {
  render: () => <EntityCard entity={restrictedEntity} />,
};

export const RelationshipRowNormal: StoryObj = {
  render: () => (
    <div className="max-w-md space-y-2">
      <RelationshipRow rel={relationship} />
      <RelationshipRow
        rel={{ ...relationship, type: 'supports', weight: 0.8, relationshipId: 'r2' }}
      />
      <RelationshipRow
        rel={{ ...relationship, type: 'describes', weight: 0.75, relationshipId: 'r3' }}
      />
    </div>
  ),
};

export const ScoreBadgeVariants: StoryObj = {
  render: () => (
    <div className="flex gap-3">
      <ScoreBadge score={0.91} />
      <ScoreBadge score={0.55} />
      <ScoreBadge score={0.2} />
    </div>
  ),
};

export const PermissionBadgeScopes: StoryObj = {
  render: () => (
    <div className="flex gap-3">
      <PermissionBadge permission={goal.permissions} />
      <PermissionBadge permission={orgEntity.permissions} />
      <PermissionBadge permission={{ ...goal.permissions, scope: 'public' }} />
    </div>
  ),
};

export const ProvenanceLineNormal: StoryObj = {
  render: () => <ProvenanceLine entity={goal} />,
};

export const ExplanationListNormal: StoryObj = {
  render: () => <ExplanationList explanations={explanations} />,
};

export const ExplanationListEmpty: StoryObj = {
  render: () => <ExplanationList explanations={[]} />,
};

export const PermissionEvaluationAllowed: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <PermissionEvaluationBanner permission={allowed} />
    </div>
  ),
};

export const PermissionEvaluationDenied: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <PermissionEvaluationBanner permission={denied} />
    </div>
  ),
};
