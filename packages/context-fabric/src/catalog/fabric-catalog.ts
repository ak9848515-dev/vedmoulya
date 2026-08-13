// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Seed Catalog
// APP-001 — Post-V1 Application Platform Layer
// The canonical seed graph: a realistic personal intelligence graph
// (user, goals, projects, tasks, skills, knowledge, memories,
// documents, preferences, work history, learning history) and a
// business/enterprise context graph (organization, teams, people,
// clients, projects, applications, capabilities) with typed,
// validated relationships, provenance and permissions. References the
// real EI seed catalogs (goal_*_seed goals, capability ids) so the
// fabric demo flows through genuine platform data.
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextPermission,
  ContextRelationship,
  ContextSource,
  ContextProvenance,
} from '../types/fabric-types.js';
import { entityId } from '../domain/rules/FabricRules.js';

export const SEED_FABRIC_USER_ID = 'user_001';
export const SEED_FABRIC_ORG_ID = 'org_vedmoulya';

const now = new Date().toISOString();

function provenance(
  source: ContextSource,
  sourceId: string,
  producedBy: string,
  confidence: number,
  reason?: string,
): ContextProvenance {
  return {
    source,
    sourceId,
    createdAt: now,
    updatedAt: now,
    producedBy,
    reason,
    confidence,
  };
}

function permission(
  owner: string,
  scope: ContextPermission['scope'],
  opts: Partial<ContextPermission> = {},
): ContextPermission {
  return {
    owner,
    scope,
    allowedUsers: opts.allowedUsers ?? [],
    allowedRoles: opts.allowedRoles ?? [],
    capability: opts.capability ?? [],
    organizationId: opts.organizationId,
    grantedAt: now,
  };
}

function personal(
  type: string,
  seed: string,
  label: string,
  description: string,
  tags: string[],
  source: ContextSource,
  sourceId: string,
  producedBy: string,
  confidence: number,
  perms: ContextPermission,
  reason?: string,
): ContextEntity {
  return {
    entityId: entityId('personal', type, seed),
    graph: 'personal',
    type: type as ContextEntity['type'],
    label,
    description,
    ownerId: SEED_FABRIC_USER_ID,
    tags,
    confidence,
    lifecycle: 'active',
    source,
    provenance: provenance(source, sourceId, producedBy, confidence, reason),
    permissions: perms,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function business(
  type: string,
  seed: string,
  label: string,
  description: string,
  tags: string[],
  source: ContextSource,
  sourceId: string,
  producedBy: string,
  confidence: number,
  perms: ContextPermission,
  reason?: string,
): ContextEntity {
  return {
    entityId: entityId('business', type, seed),
    graph: 'business',
    type: type as ContextEntity['type'],
    label,
    description,
    ownerId: SEED_FABRIC_USER_ID,
    organizationId: SEED_FABRIC_ORG_ID,
    tags,
    confidence,
    lifecycle: 'active',
    source,
    provenance: provenance(source, sourceId, producedBy, confidence, reason),
    permissions: perms,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function rel(
  seed: string,
  from: ContextEntity,
  to: ContextEntity,
  type: ContextRelationship['type'],
  weight: number,
  source: ContextSource,
  producedBy: string,
  confidence: number,
  reason?: string,
): ContextRelationship {
  return {
    relationshipId: `rel_${seed}`,
    fromId: from.entityId,
    toId: to.entityId,
    type,
    weight,
    confidence,
    source,
    provenance: provenance(
      source,
      `${from.entityId}→${to.entityId}`,
      producedBy,
      confidence,
      reason,
    ),
    createdAt: now,
    metadata: {},
  };
}

// ── Personal graph entities ───────────────────────────────────────

export const personalUser = personal(
  'user',
  'me',
  'Ved — Founder & Platform Operator',
  'Operator of the VedMoulya execution operating system; builds enterprise AI platforms and helps individuals create sustainable livelihoods.',
  ['operator', 'platform', 'founder'],
  'identity',
  'identity:user_001',
  'identity-service',
  0.98,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalGoal1 = personal(
  'goal',
  'goal_blog_seed',
  'Launch the VedMoulya blog engine',
  'Ship a content engine that publishes daily enterprise AI insights using the content-agency pipeline and quality gates.',
  ['goal', 'blog', 'content'],
  'goal',
  'goal_blog_seed',
  'goals-engine',
  0.92,
  permission(SEED_FABRIC_USER_ID, 'private'),
  'imported from the active goal registry (EI-006)',
);

export const personalGoal2 = personal(
  'goal',
  'goal_learning_seed',
  'Master enterprise context engineering',
  'Learn how to build permission-aware context fabrics by studying EI-003, EI-009 and EI-010 production patterns.',
  ['goal', 'learning', 'context'],
  'goal',
  'goal_learning_seed',
  'goals-engine',
  0.9,
  permission(SEED_FABRIC_USER_ID, 'private'),
  'imported from the active goal registry (EI-006)',
);

export const personalProject1 = personal(
  'project',
  'blog_platform',
  'Enterprise Blog Platform',
  'The production blog platform with content generation, brand alignment and SEO review workflows.',
  ['project', 'blog', 'platform'],
  'manual',
  'project:blog_platform',
  'user',
  0.88,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalTask1 = personal(
  'task',
  'publish_insights',
  'Publish 3 enterprise AI insights this week',
  'Write and publish three insight articles using the content agency generation pipeline.',
  ['task', 'publishing', 'content'],
  'task',
  'task:publish_insights',
  'goals-engine',
  0.85,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalSkill1 = personal(
  'skill',
  'ai_platform_architecture',
  'AI Platform Architecture',
  'Designing multi-engine AI platforms with strict ownership boundaries and narrow port contracts.',
  ['skill', 'architecture', 'ai'],
  'import',
  'skill:ai_platform_architecture',
  'profile-import',
  0.9,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalSkill2 = personal(
  'skill',
  'context_engineering',
  'Context Engineering',
  'Building retrieval, ranking and assembly pipelines that are permission-safe and provider-independent.',
  ['skill', 'context', 'retrieval'],
  'import',
  'skill:context_engineering',
  'profile-import',
  0.87,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalKnowledge1 = personal(
  'knowledge',
  'fabric_pattern',
  'Context Fabric Reference Pattern',
  'The canonical pattern for permission-aware context assembly: identity → permission → eligible sources → retrieval → filter → rank → package.',
  ['knowledge', 'context-fabric', 'permissions'],
  'knowledge',
  'knowledge:context_fabric_pattern',
  'knowledge-engine',
  0.84,
  permission(SEED_FABRIC_USER_ID, 'private'),
  'retrieved from the knowledge registry (EI-009)',
);

export const personalMemory1 = personal(
  'memory',
  'blog_learning',
  'Blog engine learnings',
  'The content pipeline performs best when brand rules are injected before SEO review and when quality gates run in parallel.',
  ['memory', 'blog', 'content'],
  'memory',
  'memory:blog_learning',
  'memory-engine',
  0.82,
  permission(SEED_FABRIC_USER_ID, 'private'),
  'retrieved from the memory registry (EI-010)',
);

export const personalDocument1 = personal(
  'document',
  'architecture_note',
  'OS Integration Architecture Notes',
  'Notes on the OS-001 integration: engine ownership, consultation matrices and the no-duplicated-logic rule.',
  ['document', 'architecture', 'os'],
  'document',
  'document:architecture_note',
  'import',
  0.86,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalApp1 = personal(
  'application',
  'content_agency',
  'Content Agency App',
  'The production content agency application with lead-to-invoice workflows.',
  ['application', 'content-agency'],
  'application',
  'application:content_agency',
  'system',
  0.9,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalPreference1 = personal(
  'preference',
  'prefer_brand_first',
  'Prefer brand-first generation',
  'Always align brand voice before drafting; SEO and grammar review after.',
  ['preference', 'brand', 'workflow'],
  'user_input',
  'preference:prefer_brand_first',
  'user',
  0.95,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalWorkHistory1 = personal(
  'work_history',
  'enterprise_ai',
  'Enterprise AI Platform Engineer',
  'Built and certified eleven enterprise intelligence engines across a monorepo of packages and services.',
  ['work', 'enterprise-ai'],
  'import',
  'work:enterprise_ai',
  'profile-import',
  0.93,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalLearning1 = personal(
  'learning_history',
  'ei003_study',
  'EI-003 context intelligence study',
  'Completed the EI-003 context ranking and compression study with a 96% assessment score.',
  ['learning', 'context', 'ei-003'],
  'import',
  'learning:ei003_study',
  'learning-engine',
  0.89,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

export const personalAiInteraction1 = personal(
  'ai_interaction',
  'assemble_last',
  'Last context assembly run',
  'Assembled a 1 240-token context package for the blog goal with 14 items and full permission coverage.',
  ['ai', 'context', 'assembly'],
  'system',
  'interaction:assemble_last',
  'context-fabric',
  0.9,
  permission(SEED_FABRIC_USER_ID, 'private'),
);

// ── Business graph entities ───────────────────────────────────────

const orgPerms = permission(SEED_FABRIC_USER_ID, 'organization', {
  organizationId: SEED_FABRIC_ORG_ID,
  allowedRoles: ['admin', 'member'],
});

export const businessOrg = business(
  'organization',
  'vedmoulya',
  'VedMoulya',
  'The execution operating system company — helping one million people create sustainable livelihoods.',
  ['organization', 'platform'],
  'import',
  'org:vedmoulya',
  'identity-service',
  0.97,
  orgPerms,
);

export const businessTeam1 = business(
  'team',
  'platform',
  'Platform Engineering',
  'Owns the core platform, enterprise intelligence engines and certification gates.',
  ['team', 'platform'],
  'import',
  'org:vedmoulya:team:platform',
  'identity-service',
  0.94,
  orgPerms,
);

export const businessPerson1 = business(
  'person',
  'ved',
  'Ved (Principal Engineer)',
  'Principal engineer; owns the platform architecture and the OS-001 integration.',
  ['person', 'engineering'],
  'identity',
  'person:ved',
  'identity-service',
  0.96,
  orgPerms,
);

export const businessPerson2 = business(
  'person',
  'asha',
  'Asha (Client Success)',
  'Client success lead; manages the enterprise accounts and delivery timelines.',
  ['person', 'client-success'],
  'import',
  'person:asha',
  'identity-service',
  0.9,
  orgPerms,
);

export const businessClient1 = business(
  'client',
  'northstar',
  'Northstar Retail Group',
  'Retail group consuming the content agency pipeline for weekly campaign content.',
  ['client', 'retail', 'content'],
  'import',
  'client:northstar',
  'client-ops',
  0.88,
  orgPerms,
);

export const businessProject1 = business(
  'project',
  'northstar_campaign',
  'Northstar Q3 Campaign',
  'Quarterly campaign producing 12 articles across three brands with approval workflows.',
  ['project', 'campaign', 'content'],
  'import',
  'project:northstar_campaign',
  'client-ops',
  0.86,
  orgPerms,
);

export const businessApp1 = business(
  'application',
  'content_agency',
  'Content Agency Application',
  'The content agency app: briefs, generation, review, approval, delivery, invoicing.',
  ['application', 'content-agency'],
  'application',
  'application:content_agency',
  'system',
  0.92,
  orgPerms,
);

export const businessCap1 = business(
  'business_capability',
  'content_generation',
  'Content Generation Capability',
  'Enterprise capability to generate brand-aligned content across formats.',
  ['capability', 'content'],
  'capabilities',
  'capability:content_generation',
  'capabilities-engine',
  0.91,
  orgPerms,
);

export const businessProcess1 = business(
  'process',
  'approval_flow',
  'Content Approval Flow',
  'Review → improve → approve → deliver with per-stage gates and audit trail.',
  ['process', 'approval', 'workflow'],
  'manual',
  'process:approval_flow',
  'user',
  0.83,
  orgPerms,
);

export const businessDoc1 = business(
  'document',
  'brand_guidelines',
  'Northstar Brand Guidelines',
  'The canonical brand guidelines used by the generation and review stages.',
  ['document', 'brand', 'guidelines'],
  'document',
  'document:brand_guidelines',
  'import',
  0.89,
  orgPerms,
);

// ── Personal relationships ────────────────────────────────────────

export const personalRelationships: ContextRelationship[] = [
  rel('u_owns_g1', personalUser, personalGoal1, 'owns', 1, 'inference', 'fabric', 0.98),
  rel('u_owns_g2', personalUser, personalGoal2, 'owns', 1, 'inference', 'fabric', 0.98),
  rel('u_owns_p1', personalUser, personalProject1, 'owns', 1, 'inference', 'fabric', 0.97),
  rel(
    'p1_part_of_g1',
    personalProject1,
    personalGoal1,
    'part_of',
    0.9,
    'inference',
    'fabric',
    0.95,
  ),
  rel('g1_supports_t1', personalGoal1, personalTask1, 'supports', 0.9, 'inference', 'fabric', 0.96),
  rel('u_owns_t1', personalUser, personalTask1, 'responsible_for', 1, 'inference', 'fabric', 0.97),
  rel('u_has_skill1', personalUser, personalSkill1, 'related_to', 0.85, 'inference', 'fabric', 0.9),
  rel('u_has_skill2', personalUser, personalSkill2, 'related_to', 0.85, 'inference', 'fabric', 0.9),
  rel(
    'k1_supports_g1',
    personalKnowledge1,
    personalGoal1,
    'supports',
    0.8,
    'inference',
    'fabric',
    0.88,
  ),
  rel(
    'm1_supports_g1',
    personalMemory1,
    personalGoal1,
    'supports',
    0.78,
    'inference',
    'fabric',
    0.86,
  ),
  rel(
    'doc1_describes_p1',
    personalDocument1,
    personalProject1,
    'describes',
    0.82,
    'inference',
    'fabric',
    0.87,
  ),
  rel('app1_uses_by_u', personalUser, personalApp1, 'uses', 0.9, 'inference', 'fabric', 0.94),
  rel(
    'pref1_supports_g1',
    personalPreference1,
    personalGoal1,
    'supports',
    0.75,
    'inference',
    'fabric',
    0.85,
  ),
  rel(
    'work1_responsible_u',
    personalUser,
    personalWorkHistory1,
    'responsible_for',
    0.8,
    'inference',
    'fabric',
    0.9,
  ),
  rel(
    'learn1_part_of_u',
    personalSkill2,
    personalLearning1,
    'part_of',
    0.8,
    'inference',
    'fabric',
    0.88,
  ),
  rel(
    'ai1_produced_by',
    personalAiInteraction1,
    personalUser,
    'produced_by',
    0.9,
    'inference',
    'fabric',
    0.92,
  ),
];

// ── Business relationships ────────────────────────────────────────

export const businessRelationships: ContextRelationship[] = [
  rel(
    'p1_member_team',
    businessPerson1,
    businessTeam1,
    'member_of',
    1,
    'inference',
    'fabric',
    0.98,
  ),
  rel(
    'p2_member_team',
    businessPerson2,
    businessTeam1,
    'member_of',
    0.95,
    'inference',
    'fabric',
    0.97,
  ),
  rel('team_part_org', businessTeam1, businessOrg, 'part_of', 1, 'inference', 'fabric', 0.98),
  rel('org_owns_p1', businessOrg, businessProject1, 'owns', 1, 'inference', 'fabric', 0.96),
  rel(
    'p1_responsible_asha',
    businessPerson2,
    businessProject1,
    'responsible_for',
    0.95,
    'inference',
    'fabric',
    0.97,
  ),
  rel('p1_uses_app', businessProject1, businessApp1, 'uses', 0.95, 'inference', 'fabric', 0.96),
  rel(
    'app_implements_cap',
    businessApp1,
    businessCap1,
    'implements',
    0.95,
    'inference',
    'fabric',
    0.97,
  ),
  rel(
    'cap_supports_goal',
    businessCap1,
    personalGoal1,
    'supports',
    0.85,
    'inference',
    'fabric',
    0.9,
  ),
  rel('proc_part_org', businessProcess1, businessOrg, 'part_of', 0.8, 'inference', 'fabric', 0.88),
  rel(
    'doc_describes_proc',
    businessDoc1,
    businessProcess1,
    'describes',
    0.85,
    'inference',
    'fabric',
    0.9,
  ),
  rel(
    'doc_describes_p1',
    businessDoc1,
    businessProject1,
    'describes',
    0.85,
    'inference',
    'fabric',
    0.9,
  ),
  rel('client_part_org', businessClient1, businessOrg, 'part_of', 0.9, 'inference', 'fabric', 0.93),
  rel(
    'client_responsible_asha',
    businessPerson2,
    businessClient1,
    'responsible_for',
    0.95,
    'inference',
    'fabric',
    0.96,
  ),
];

// ── Catalog factory ───────────────────────────────────────────────

export function createCatalogFabricEntities(): ContextEntity[] {
  return [
    personalUser,
    personalGoal1,
    personalGoal2,
    personalProject1,
    personalTask1,
    personalSkill1,
    personalSkill2,
    personalKnowledge1,
    personalMemory1,
    personalDocument1,
    personalApp1,
    personalPreference1,
    personalWorkHistory1,
    personalLearning1,
    personalAiInteraction1,
    businessOrg,
    businessTeam1,
    businessPerson1,
    businessPerson2,
    businessClient1,
    businessProject1,
    businessApp1,
    businessCap1,
    businessProcess1,
    businessDoc1,
  ];
}

export function createCatalogFabricRelationships(): ContextRelationship[] {
  return [...personalRelationships, ...businessRelationships];
}

export const SEED_FABRIC_ENTITY_COUNT = createCatalogFabricEntities().length;
export const SEED_FABRIC_RELATIONSHIP_COUNT = createCatalogFabricRelationships().length;
