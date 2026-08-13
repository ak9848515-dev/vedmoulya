// ──────────────────────────────────────────────────────────────────
// VedMoulya — InMemoryCapabilityPlanStore
// EPIC-013 — bounded, owner-scoped plan store.
// Retains at most maxPlansPerOwner plans per user (FIFO eviction).
// Plans are keyed by owner — owner isolation is structural, there is
// no cross-user surface (IDOR-safe by construction).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await */
// In-memory store implementing the Promise-returning CapabilityPlanStore
// contract — the `async` keyword is REQUIRED for interface conformance even
// though the map-backed bodies never await (documented repo convention).

import type { CapabilityPlanSummary, FactoryCapabilityPlan } from '../types/capability-types.js';
import type { CapabilityPlanStore } from '../domain/CapabilityPlanStore.js';

export interface InMemoryCapabilityPlanStoreOptions {
  maxPlansPerOwner?: number;
}

export class InMemoryCapabilityPlanStore implements CapabilityPlanStore {
  private readonly maxPlansPerOwner: number;
  /** ownerId → ordered list of plans (newest last). */
  private readonly plansByOwner = new Map<string, FactoryCapabilityPlan[]>();

  constructor(options: InMemoryCapabilityPlanStoreOptions = {}) {
    this.maxPlansPerOwner = options.maxPlansPerOwner ?? 20;
  }

  async save(ownerId: string, plan: FactoryCapabilityPlan): Promise<void> {
    const list = this.plansByOwner.get(ownerId) ?? [];
    list.push(plan);
    // FIFO eviction — bounded memory.
    while (list.length > this.maxPlansPerOwner) {
      list.shift();
    }
    this.plansByOwner.set(ownerId, list);
  }

  async get(ownerId: string, planId: string): Promise<FactoryCapabilityPlan | undefined> {
    const list = this.plansByOwner.get(ownerId) ?? [];
    return list.find((plan) => plan.id === planId);
  }

  async list(ownerId: string): Promise<CapabilityPlanSummary[]> {
    const list = this.plansByOwner.get(ownerId) ?? [];
    return list.map((plan) => ({
      id: plan.id,
      requestedOutcome: plan.requestedOutcome,
      createdAt: plan.createdAt,
      automationPercent: plan.automationPercent,
      automationLevel: plan.automationLevel,
      unavailableCount: plan.unavailableCapabilities.length,
    }));
  }
}
