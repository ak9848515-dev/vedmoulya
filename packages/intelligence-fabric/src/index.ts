// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · public barrel
// SPRINT-030 — a COMPOSITION layer over the frozen estate: no engine, no new
// authority. Exposes the orchestration contract, the deterministic policies
// and the composition service.
// ─────────────────────────────────────────────────────────────────────────────

export * from './types/fabric-types.js';
export { ProviderHealthLedger } from './domain/ProviderHealthLedger.js';
export type { ProviderHealthLedgerOptions } from './domain/ProviderHealthLedger.js';
export { CostPolicyGuard } from './domain/CostPolicyGuard.js';
export type { CostPolicyCheckInput } from './domain/CostPolicyGuard.js';
export { AutonomyPolicy } from './domain/AutonomyPolicy.js';
export type { AutonomyGateInput } from './domain/AutonomyPolicy.js';
export { SelectionStrategy } from './domain/SelectionStrategy.js';
export type { StrategyInput } from './domain/SelectionStrategy.js';
export { VerificationChainPolicy } from './domain/VerificationChainPolicy.js';
export type {
  ChainStepResult,
  ChainEvaluation,
  VerificationPlan,
} from './domain/VerificationChainPolicy.js';
export { WorkflowBounds } from './domain/WorkflowBounds.js';
export { normalizeResult } from './domain/ResultNormalizer.js';
export type { RawProviderResponse } from './domain/ResultNormalizer.js';
export { IntelligenceFabricService } from './application/IntelligenceFabricService.js';
export type { FabricServiceOptions } from './application/IntelligenceFabricService.js';
export type { FabricCostPort, FabricProviderPort } from './contracts/fabric-ports.js';
