// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · public barrel
// SPRINT-029 — a COMPOSITION layer over the frozen estate: no engine, no new
// authority. Exposes the recommendation model, the classification policies
// and the composition service.
// ─────────────────────────────────────────────────────────────────────────────

export * from './types/proactive-types.js';
export * from './contracts/proactive-ports.js';
export { ActionClassPolicy } from './domain/ActionClassPolicy.js';
export type { ActionClassDecision } from './domain/ActionClassPolicy.js';
export { AutomationDiscovery } from './domain/AutomationDiscovery.js';
export type { AutomationDiscoveryInput, DiscoveryResult } from './domain/AutomationDiscovery.js';
export { BusinessOpportunityAssessor } from './domain/BusinessOpportunityAssessor.js';
export type { BusinessOpportunityInput } from './domain/BusinessOpportunityAssessor.js';
export { DailyBriefingAssembler } from './domain/DailyBriefingAssembler.js';
export type { BriefingInput } from './domain/DailyBriefingAssembler.js';
export { ProactiveIntelligenceService } from './application/ProactiveIntelligenceService.js';
export type {
  ProactiveServiceOptions,
  ProactiveResult,
} from './application/ProactiveIntelligenceService.js';
export { InMemoryProactiveStore } from './infrastructure/InMemoryProactiveStore.js';
export { PostgresProactiveStore } from './infrastructure/PostgresProactiveStore.js';
