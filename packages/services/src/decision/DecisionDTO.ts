// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Application DTOs
// Data Transfer Objects for the Decision Intelligence Engine
// ──────────────────────────────────────────────────────────────────

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface CreateDecisionDTO {
  title: string;
  description: string;
  category: string;
  priorityScore?: number;
  initiator?: string;
  requester?: string;
  requestReason?: string;
  requestContext?: string;
  knowledgeNodeIds?: string[];
  memoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateDecisionDTO {
  title?: string;
  description?: string;
  priorityScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AddOptionDTO {
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedEffort?: string;
  estimatedCost?: string;
}

export interface ScoreOptionDTO {
  optionId: string;
  criteria: Array<{ criterion: string; score: number; weight: number }>;
}

export interface AssessRiskDTO {
  optionId: string;
  riskScore: number;
  description: string;
  mitigation?: string;
}

export interface AssessOpportunityDTO {
  optionId: string;
  opportunityScore: number;
  description: string;
  expectedValue?: string;
}

export interface CompleteDecisionDTO {
  result: 'success' | 'partial' | 'neutral' | 'failure' | 'unknown';
  description: string;
  actualImpact?: string;
  lessons?: string[];
}

export interface DecideDTO {
  optionId: string;
  reasoningMethod: string;
  reasoningSummary: string;
  assumptions?: string[];
  pros?: string[];
  cons?: string[];
}

// ── Query DTOs ───────────────────────────────────────────────────────────

export interface DecisionQueryDTO {
  query?: string;
  categories?: string[];
  statuses?: string[];
  priorityMin?: number;
  priorityMax?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface DecisionDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: { level: string; score: number };
  confidence: { level: string; score: number };
  version: string;
  initiator: string;
  request?: { requester: string; reason: string; context: string };
  options: DecisionOptionDTO[];
  selectedOptionId?: string;
  evidence: DecisionEvidenceDTO[];
  constraints: string[];
  reasoning?: {
    method: string;
    summary: string;
    assumptions: string[];
    pros: string[];
    cons: string[];
  };
  outcome?: { result: string; description: string; actualImpact?: string; lessons?: string[] };
  knowledgeNodeIds: string[];
  memoryIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DecisionOptionDTO {
  id: string;
  label: string;
  description: string;
  score?: {
    overall: number;
    criteria: Array<{ criterion: string; score: number; weight: number; weightedScore: number }>;
  };
  risk?: { level: string; score: number; description: string; mitigation?: string };
  opportunity?: { level: string; score: number; description: string; expectedValue?: string };
  pros: string[];
  cons: string[];
  estimatedEffort?: string;
  estimatedCost?: string;
}

export interface DecisionEvidenceDTO {
  id: string;
  type: string;
  source: string;
  content: string;
  relevanceScore: number;
  timestamp: string;
}

export interface DecisionListDTO {
  data: DecisionDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DecisionStatsDTO {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  linkedCount: number;
}

export interface RankingDTO {
  optionId: string;
  label: string;
  score: number;
  riskLevel: string;
  opportunityLevel: string;
  rank: number;
}

export interface RecommendationDTO {
  decisionId: string;
  title: string;
  recommendedOptionId: string;
  recommendedOptionLabel: string;
  confidence: number;
  reasons: string[];
}

export interface TradeoffDTO {
  optionA: string;
  optionB: string;
  scoreDiff: number;
  riskDiff: number;
  opportunityDiff: number;
  recommendation: string;
}

// ── Contract Events ──────────────────────────────────────────────────────

export interface DecisionContractEvent {
  type:
    | 'decision.created'
    | 'decision.made'
    | 'decision.completed'
    | 'decision.archived'
    | 'decision.cancelled';
  decisionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
