// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Types (Service Layer)
// Shared types for the Decision Intelligence Engine service
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

// ── Service Operation Result ──────────────────────────────────────────────
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  statusCode?: number;
}

// ── Explainability Types ──────────────────────────────────────────────────
export type ExplanationFormat = 'short' | 'standard' | 'detailed' | 'raw';

export interface ExplanationComponent {
  type:
    | 'reason'
    | 'dna_attribution'
    | 'problem_mapping'
    | 'journey_context'
    | 'confidence_display'
    | 'alternatives';
  content: string;
  priority: number;
}

export interface DecisionExplanation {
  decisionId: string;
  format: ExplanationFormat;
  summary: string;
  reason: string;
  dnaAttribution: Array<{ dimension: string; attribute: string }>;
  problemsAddressed: Array<{ problemId: string; description: string }>;
  journeyStage: string;
  confidenceText: string;
  alternatives: Array<{ optionId: string; label: string; reason: string }>;
  rawData?: Record<string, unknown>;
}

// ── Knowledge Graph Integration Types (BLD-006 Contracts) ───────────────
export interface KnowledgeQuery {
  intent: 'decision' | 'planning' | 'learning';
  context: {
    userId: string;
    goalIds?: string[];
    skillIds?: string[];
    projectIds?: string[];
    category?: string;
  };
  scope?: string;
  qualityThreshold?: number;
  depth?: 'simple' | 'standard' | 'detailed';
}

export interface KnowledgeResult {
  entityId: string;
  label: string;
  type: string;
  relevance: number;
  confidence: number;
  evidence: string;
  temporal: string;
  connections: Array<{ id: string; label: string; type: string }>;
}

export interface KnowledgeQueryResponse {
  results: KnowledgeResult[];
  metadata: {
    totalResults: number;
    qualityRange: { min: number; max: number };
    queryTime: number;
  };
}

// ── Memory Integration Types (BLD-007 Contracts) ─────────────────────────
export interface MemoryQuery {
  intent: 'experience' | 'timeline' | 'observation' | 'past_decision';
  context: {
    userId: string;
    decisionId?: string;
    category?: string;
    timeRange?: { start: Date; end: Date };
  };
  minConfidence?: number;
  limit?: number;
}

export interface MemoryResult {
  memoryId: string;
  content: string;
  type: string;
  confidence: number;
  importance: number;
  timestamp: Date;
  source: string;
  relevanceScore: number;
}

export interface MemoryQueryResponse {
  results: MemoryResult[];
  metadata: {
    totalResults: number;
    queryTime: number;
  };
}

// ── AI Orchestrator Integration Types (BLD-005 Contracts) ───────────────
export interface AIReasoningRequest {
  capability: 'reasoning' | 'analysis' | 'option_generation' | 'explanation';
  userInput: string;
  context: Record<string, unknown>;
  constraints?: {
    format?: string;
    maxLength?: number;
  };
  qualityTier?: 'premium' | 'standard' | 'economy';
  requestId?: string;
}

export interface AIReasoningResponse {
  content: string;
  provider: string;
  confidence: number;
  qualityScore: number;
  latency: number;
  traceId: string;
}

// ── Explainability Request/Response Types ──────────────────────────────
export interface ExplainabilityRequest {
  decisionId: string;
  format?: ExplanationFormat;
  includeAlternatives?: boolean;
  maxAlternatives?: number;
}

export interface ExplainabilityResponse {
  decisionId: string;
  explanation: DecisionExplanation;
  format: ExplanationFormat;
  generatedAt: string;
}

// ── Health Check Types ──────────────────────────────────────────────────
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  checks: Record<string, 'pass' | 'fail' | 'degraded'>;
  dependencies: Record<string, { status: string; latency: number }>;
}
