// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Workflow Registry
// SPRINT-050 — AI Ecosystem Foundation
//
// A lightweight in-memory registry for Workflow definitions.
// Owner-scoped, no persistence engine — follows the estate convention.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { WorkflowDefinition, WorkflowStatus } from '../../types/ecosystem-types.js';
import { Workflow } from '../entities/Workflow.js';

export interface WorkflowSearchCriteria {
  query?: string;
  status?: WorkflowStatus;
  requiredCapabilities?: CapabilityType[];
  owner?: string;
  tags?: string[];
}

export class WorkflowRegistry {
  private readonly workflows = new Map<string, Workflow>();

  register(workflow: Workflow): void {
    if (this.workflows.has(workflow.id)) {
      throw new Error(`Workflow ${workflow.id} is already registered`);
    }
    this.workflows.set(workflow.id, workflow);
  }

  unregister(workflowId: string): void {
    this.workflows.delete(workflowId);
  }

  findById(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values()).map((w) => w.toDefinition());
  }

  listByStatus(status: WorkflowStatus): WorkflowDefinition[] {
    return this.list().filter((w) => w.status === status);
  }

  listByOwner(owner: string): WorkflowDefinition[] {
    return this.list().filter((w) => w.owner === owner);
  }

  listByCapability(capability: CapabilityType): WorkflowDefinition[] {
    return this.list().filter((w) =>
      w.steps.some((s) => s.requiredCapabilities.includes(capability)),
    );
  }

  search(criteria: WorkflowSearchCriteria): WorkflowDefinition[] {
    let results = this.list();

    if (criteria.status) {
      results = results.filter((w) => w.status === criteria.status);
    }
    if (criteria.owner) {
      results = results.filter((w) => w.owner === criteria.owner);
    }
    const requiredCaps = criteria.requiredCapabilities;
    if (requiredCaps && requiredCaps.length > 0) {
      results = results.filter((w) =>
        requiredCaps.some((cap) => w.steps.some((s) => s.requiredCapabilities.includes(cap))),
      );
    }
    const filterTags = criteria.tags;
    if (filterTags && filterTags.length > 0) {
      results = results.filter((w) => filterTags.some((tag) => w.tags.includes(tag)));
    }
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      results = results.filter(
        (w) => w.name.toLowerCase().includes(q) || w.outcome.toLowerCase().includes(q),
      );
    }

    return results;
  }

  /** Count of registered workflows. */
  get size(): number {
    return this.workflows.size;
  }
}
