// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · shared structural types
// SPRINT-029 — structural views of frozen-estate records, defined here so the
// proactive package never imports the full engine internals. The gateway maps
// the real records onto these shapes (same discipline as the voice package's
// BrainTaskPort).
// ─────────────────────────────────────────────────────────────────────────────

export interface BrainTaskLike {
  id: string;
  userId: string;
  objective: string;
  status: string;
  stage: string;
  createdAt: string;
}

export interface BrainOpportunityLike {
  id: string;
  userId: string;
  category: string;
  title: string;
  description: string;
  evidence: string[];
  uncertainty: number;
  estimatedValue?: { label: string; status: string };
  requiredCapabilities?: string[];
  risk?: string;
  status: string;
  createdAt: string;
}

export interface BrainEventLike {
  id: string;
  userId: string;
  kind: string;
  title: string;
  description: string;
  relevance: number;
  createdAt: string;
}

export interface RankedActionLike {
  id: string;
  title: string;
  /** OutcomePriority label (CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN). */
  urgency: string;
  priorityScore?: number;
  reason?: string;
}

export interface OutcomeMemoryLike {
  id: string;
  userId: string;
  taskId?: string;
  verdict: string;
  satisfaction?: string;
  createdAt: string;
  objective?: string;
}
