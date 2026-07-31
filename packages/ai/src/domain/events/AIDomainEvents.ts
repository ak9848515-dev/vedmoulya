// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Domain Events
// Domain event types for the AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

export const AI_DOMAIN_EVENTS = {
  // Request lifecycle
  REQUEST_CREATED: 'ai.request.created',
  REQUEST_ROUTED: 'ai.request.routed',
  REQUEST_EXECUTION_STARTED: 'ai.request.execution_started',
  REQUEST_COMPLETED: 'ai.request.completed',
  REQUEST_FAILED: 'ai.request.failed',
  REQUEST_FALLBACK: 'ai.request.fallback',

  // Provider events
  PROVIDER_HEALTH_CHANGED: 'ai.provider.health_changed',
  PROVIDER_RATE_LIMITED: 'ai.provider.rate_limited',
  PROVIDER_DOWN: 'ai.provider.down',
  PROVIDER_RECOVERED: 'ai.provider.recovered',

  // Capability events
  CAPABILITY_REGISTERED: 'ai.capability.registered',
  CAPABILITY_UPDATED: 'ai.capability.updated',

  // Cost events
  COST_THRESHOLD_EXCEEDED: 'ai.cost.threshold_exceeded',
  BUDGET_EXCEEDED: 'ai.cost.budget_exceeded',

  // Validation events
  VALIDATION_PASSED: 'ai.validation.passed',
  VALIDATION_FAILED: 'ai.validation.failed',
  SAFETY_VIOLATION: 'ai.validation.safety_violation',
  HALLUCINATION_DETECTED: 'ai.validation.hallucination_detected',

  // Observability events
  LATENCY_THRESHOLD_EXCEEDED: 'ai.observability.latency_threshold_exceeded',
  ERROR_RATE_THRESHOLD_EXCEEDED: 'ai.observability.error_rate_threshold_exceeded',
} as const;

export type AIDomainEventType = (typeof AI_DOMAIN_EVENTS)[keyof typeof AI_DOMAIN_EVENTS];
