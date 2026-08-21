// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Agent Registry
// SPRINT-050 — AI Ecosystem Foundation
//
// A lightweight in-memory registry for Agent definitions.
// Owner-scoped, no persistence engine — follows the estate convention
// (in-memory for dev/test, Postgres for production via a future adapter).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { AgentDefinition, AgentStatus } from '../../types/ecosystem-types.js';
import { Agent } from '../entities/Agent.js';

export interface AgentSearchCriteria {
  query?: string;
  status?: AgentStatus;
  requiredCapabilities?: CapabilityType[];
  owner?: string;
  tags?: string[];
}

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  findById(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  list(): AgentDefinition[] {
    return Array.from(this.agents.values()).map((a) => a.toDefinition());
  }

  listByStatus(status: AgentStatus): AgentDefinition[] {
    return this.list().filter((a) => a.status === status);
  }

  listByOwner(owner: string): AgentDefinition[] {
    return this.list().filter((a) => a.owner === owner);
  }

  listByCapability(capability: CapabilityType): AgentDefinition[] {
    return this.list().filter((a) => a.requiredCapabilities.includes(capability));
  }

  search(criteria: AgentSearchCriteria): AgentDefinition[] {
    let results = this.list();

    if (criteria.status) {
      results = results.filter((a) => a.status === criteria.status);
    }
    if (criteria.owner) {
      results = results.filter((a) => a.owner === criteria.owner);
    }
    const requiredCaps = criteria.requiredCapabilities;
    if (requiredCaps && requiredCaps.length > 0) {
      results = results.filter((a) =>
        requiredCaps.some((cap) => a.requiredCapabilities.includes(cap)),
      );
    }
    const filterTags = criteria.tags;
    if (filterTags && filterTags.length > 0) {
      results = results.filter((a) => filterTags.some((tag) => a.tags.includes(tag)));
    }
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      results = results.filter(
        (a) => a.name.toLowerCase().includes(q) || a.purpose.toLowerCase().includes(q),
      );
    }

    return results;
  }

  /** Count of registered agents. */
  get size(): number {
    return this.agents.size;
  }
}
