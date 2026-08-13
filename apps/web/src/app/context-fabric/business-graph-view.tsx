// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Business Graph view
// APP-001 — Post-V1 Application Platform Layer
// The organization/business-level context graph: organization — people,
// teams, clients, projects, processes, applications, policies, knowledge
// and business capabilities, with capability chains like team → owns →
// project → uses → application → implements → capability.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricBusinessGraph } from '../../lib/api-client.js';
import { Building2, GitBranch } from 'lucide-react';
import { EntityCard, RelationshipRow } from './components.js';
import { pct } from './fabric-ui.js';

const SEED_ORG = 'org_vedmoulya';

export function BusinessGraphView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useContextFabricBusinessGraph(userId, SEED_ORG);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading the enterprise context graph…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="Business graph unavailable"
        description="The enterprise context graph could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const entities = data.entities;
  const people = entities.filter((entity) => entity.type === 'person');
  const teams = entities.filter((entity) => entity.type === 'team');
  const projects = entities.filter((entity) => entity.type === 'project');
  const applications = entities.filter((entity) => entity.type === 'application');
  const capabilities = entities.filter((entity) => entity.type === 'business_capability');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
          {data.organizationId}
        </Badge>
        <Badge className="bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95] dark:text-[#DDD6FE]">
          {entities.length} entities
        </Badge>
        <Badge className="bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]">
          {data.relationships.length} relationships
        </Badge>
        <Badge className="bg-[#FFF7ED] text-[#9A3412] dark:bg-[#431407] dark:text-[#FED7AA]">
          avg confidence {pct(data.stats.avgConfidence)}
        </Badge>
      </div>

      <Card className="p-5 dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#2B5FD9]" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Capability chain — {people.length} people · {teams.length} teams · {projects.length}{' '}
            projects · {applications.length} applications · {capabilities.length} capabilities
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          person → member_of → team → owns → project → uses → application → implements → capability.
          The fabric models the relationships between who, what and how work gets done.
        </p>
        <div className="mt-4 space-y-2">
          {data.relationships.map((rel) => (
            <RelationshipRow key={rel.relationshipId} rel={rel} />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entities.map((entity) => (
          <EntityCard key={entity.entityId} entity={entity} />
        ))}
      </div>
    </div>
  );
}
