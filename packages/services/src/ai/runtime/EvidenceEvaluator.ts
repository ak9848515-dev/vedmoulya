// ──────────────────────────────────────────────────────────────────
// VedMoulya — Evidence Evaluator (Evidence-First AI foundation)
// Measures groundedness of retrieved evidence for RAG-grounded tasks
// and decides whether the runtime must ABSTAIN rather than fabricate.
//
// States (AI-RUNTIME-002 Phase 8):
//   SUFFICIENT_EVIDENCE   — grounded, confident, non-conflicting
//   PARTIAL_EVIDENCE      — some grounding, low/medium confidence
//   INSUFFICIENT_EVIDENCE — not enough grounding for a grounded answer
//   CONFLICTING_EVIDENCE  — multiple sources disagree materially
//
// Deterministic, provider-independent, no LLM required. Full AI-EVAL-001
// evaluation remains a future sprint; this is the runtime contract it
// will consume.
// ──────────────────────────────────────────────────────────────────

/** Groundedness state for one runtime execution. */
export type EvidenceState =
  'SUFFICIENT_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE';

/** One retrieved evidence item (RAG chunk). */
export interface EvidenceItem {
  title: string;
  content: string;
  /** Retrieval relevance score (0..1). */
  score: number;
  /** Source authority bucket: knowledge_base/business_rules are strong, conversation is weak. */
  source: string;
  /** ISO timestamp of the source document (freshness). */
  updatedAt?: string;
}

/** Typed measurement of how well an answer can be grounded in evidence. */
export interface EvidenceAssessment {
  state: EvidenceState;
  /** Number of retrieved evidence items. */
  evidenceCount: number;
  /** 0..1 — how much of the expected evidence was found. */
  availability: number;
  /** 0..1 — composite groundedness (availability + relevance + freshness). */
  groundedness: number;
  /** 0..1 — mean retrieval relevance of the items. */
  relevance: number;
  /** 0..1 — mean source authority. */
  sourceAuthority: number;
  /** 0..1 — mean source freshness (recency decay). */
  sourceFreshness: number;
  /** True when ≥2 sources disagree materially on the same topic. */
  conflictingEvidence: boolean;
  /** Human-readable reasons for the state (for telemetry/debugging). */
  reasons: string[];
}

export interface EvidenceEvaluationOptions {
  /** Required evidence count for a SUFFICIENT verdict. Default: 2. */
  minEvidenceCount?: number;
  /** Minimum mean relevance for SUFFICIENT. Default: 0.55. */
  minRelevance?: number;
  /**
   * Minimum per-item relevance for an item to participate in conflict
   * detection. Default: 0.3 (validated AI-RUNTIME-003 Phase 5). Without this
   * floor, low-relevance retrieval noise (e.g. two unrelated-but-similar docs
   * surfaced at ~0.2–0.29) would be treated as CONFLICTING evidence and force
   * abstention on a perfectly grounded query. Only ON-TOPIC items can
   * disagree.
   *
   * Calibration note (measured 2026-08-08): a weaker floor (0.25) was
   * evaluated because a genuine conflicting source can be retrieved as low as
   * 0.2983 under a weakly-matched query. It was REJECTED: with the
   * deterministic mock embedding, unrelated documents leak into retrieval at
   * 0.27–0.29, and the lower floor made those irrelevant leaks participate in
   * conflict detection — falsely abstaining on a grounded question that also
   * retrieved an unrelated conflicting pair (rag:eval stale-doc-preference
   * regression, sufficiency 1.000 → 0.833). 0.3 is the correct boundary for
   * this embedding model. Real-world conflicting evidence is retrieved at
   * 0.55+ under a well-formed query (accuracy evaluation); the runtime never
   * fabricates on a conflict it does detect, and a weakly-matched query that
   * fails to surface both sides of a conflict degrades to PARTIAL (serve
   * with low confidence) rather than a wrong confident answer.
   */
  minConflictRelevance?: number;
  /** When true the caller asserts the task MUST be grounded in evidence. */
  groundingRequired?: boolean;
}

/** Deterministic groundedness thresholds. */
const SUFFICIENT_GROUNDEDNESS = 0.65;
const PARTIAL_GROUNDEDNESS = 0.4;

/**
 * Conflict-similarity band — VALIDATED, NOT CHANGED (AI-RUNTIME-003 Phase 2/5,
 * measured 2026-08-08). A calibration candidate (raising the lower bound to
 * 0.45) was measured and REJECTED:
 *
 * Measured ngram similarities:
 *   - retention HR vs Finance (genuine conflict)    0.777
 *   - yes vs no (genuine conflict)                  0.667
 *   - deadline Q3 vs Q4 (genuine conflict)          0.543
 *   - short conflict pair "retained for seven years"
 *     vs "deleted after thirty days" (genuine)      0.306
 *   - complementary campaign-report docs            0.317
 *   - prompt-injection vs KB disclaimer             0.333
 *   - agreement pair (sufficient evidence)          0.337
 *   - verbatim duplicate                            1.000
 *
 * The shortest genuine conflict (0.306) and the complementary pair (0.317)
 * are 0.011 apart — NO similarity threshold can separate them. A 0.45 floor
 * would silently miss the short genuine conflict (runtime would serve a
 * possibly-wrong confident answer on a real disagreement — unacceptable for
 * the Evidence-First contract), while the wide band's complementary-doc
 * false positive errs SAFELY (conservative abstention). The frozen band
 * [0.2, 0.85] is therefore retained, and the complementary-doc abstention
 * is a documented known limitation: a content-aware claim-contradiction
 * discriminator (AI-EVAL future sprint) is required to separate the two.
 */
const CONFLICT_SIM_MIN = 0.2;
const CONFLICT_SIM_MAX = 0.85;

/** Character n-gram similarity used for the deterministic conflict check. */
function similarity(a: string, b: string): number {
  const grams = (text: string, n = 3): Set<string> => {
    const set = new Set<string>();
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= normalized.length - n; i++) {
      set.add(normalized.slice(i, i + n));
    }
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let overlap = 0;
  for (const gram of ga) {
    if (gb.has(gram)) overlap += 1;
  }
  return overlap / Math.max(ga.size, gb.size);
}

export class EvidenceEvaluator {
  /** Classify retrieved evidence into one of the four groundedness states. */
  evaluate(
    items: readonly EvidenceItem[],
    options: EvidenceEvaluationOptions = {},
  ): EvidenceAssessment {
    const minEvidenceCount = options.minEvidenceCount ?? 2;
    const minRelevance = options.minRelevance ?? 0.55;
    const minConflictRelevance = options.minConflictRelevance ?? 0.3;
    const reasons: string[] = [];

    if (items.length === 0) {
      return {
        state: 'INSUFFICIENT_EVIDENCE',
        evidenceCount: 0,
        availability: 0,
        groundedness: 0,
        relevance: 0,
        sourceAuthority: 0,
        sourceFreshness: 0,
        conflictingEvidence: false,
        reasons: ['no evidence retrieved'],
      };
    }

    const relevance =
      items.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.score)), 0) / items.length;
    const sourceAuthority =
      items.reduce((sum, item) => sum + this.authorityFor(item.source), 0) / items.length;
    const sourceFreshness =
      items.reduce((sum, item) => sum + this.freshnessFor(item.updatedAt), 0) / items.length;

    // Availability: 1.0 when we found at least the expected evidence count.
    const availability = Math.min(1, items.length / Math.max(1, minEvidenceCount));

    // Composite groundedness: evidence mass + relevance + freshness + authority.
    const groundedness = Math.max(
      0,
      Math.min(
        1,
        availability * 0.4 + relevance * 0.3 + sourceFreshness * 0.15 + sourceAuthority * 0.15,
      ),
    );

    // Deterministic conflict detection: two distinct sources with materially
    // different content on the same topic is conflicting evidence. Only items
    // individually relevant enough to ground an answer (score >= the conflict
    // floor) can conflict — retrieval noise never triggers abstention.
    const conflictingEvidence = this.detectConflict(items, minConflictRelevance);

    if (conflictingEvidence) {
      reasons.push('multiple sources disagree materially on the same topic');
    } else if (groundedness >= SUFFICIENT_GROUNDEDNESS && items.length >= minEvidenceCount) {
      reasons.push('sufficient evidence coverage');
      reasons.push(`mean relevance ${relevance.toFixed(2)} above threshold`);
    } else if (groundedness >= PARTIAL_GROUNDEDNESS || items.length >= 1) {
      reasons.push('partial evidence coverage');
    } else {
      reasons.push('insufficient evidence coverage');
    }
    reasons.push(`groundedness ${groundedness.toFixed(2)}`);

    let state: EvidenceState;
    if (conflictingEvidence) {
      state = 'CONFLICTING_EVIDENCE';
    } else if (
      groundedness >= SUFFICIENT_GROUNDEDNESS &&
      items.length >= minEvidenceCount &&
      relevance >= minRelevance
    ) {
      state = 'SUFFICIENT_EVIDENCE';
    } else if (groundedness >= PARTIAL_GROUNDEDNESS && items.length >= 1) {
      state = 'PARTIAL_EVIDENCE';
    } else {
      state = 'INSUFFICIENT_EVIDENCE';
    }

    return {
      state,
      evidenceCount: items.length,
      availability,
      groundedness,
      relevance,
      sourceAuthority,
      sourceFreshness,
      conflictingEvidence,
      reasons,
    };
  }

  /**
   * Abstention rule: when a task REQUIRES grounding, the runtime must abstain
   * rather than fabricate if evidence is insufficient or irreconcilably
   * conflicting. Partial evidence never forces abstention — it lowers
   * confidence instead.
   */
  shouldAbstain(assessment: EvidenceAssessment, groundingRequired: boolean): boolean {
    if (!groundingRequired) return false;
    return (
      assessment.state === 'INSUFFICIENT_EVIDENCE' || assessment.state === 'CONFLICTING_EVIDENCE'
    );
  }

  /** Deterministic source-authority scoring. */
  private authorityFor(source: string): number {
    switch (source) {
      case 'knowledge_base':
      case 'business_rules':
        return 1;
      case 'enterprise_memory':
      case 'project_data':
        return 0.8;
      case 'conversation_memory':
        return 0.4;
      default:
        return 0.5;
    }
  }

  /** Recency decay: documents updated within 30 days score 1.0, older decays. */
  private freshnessFor(updatedAt?: string): number {
    if (!updatedAt) return 0.7;
    const ageDays = (Date.now() - Date.parse(updatedAt)) / 86_400_000;
    if (Number.isNaN(ageDays) || ageDays <= 0) return 0.7;
    return Math.max(0.1, Math.min(1, 1 - ageDays / 365));
  }

  /**
   * Two items from DIFFERENT sources about the SAME topic with materially
   * different claims → conflicting evidence. Deterministic proxy: different
   * sources whose content similarity lands in the conflict band (same topic,
   * not identical) indicate disagreement. The band [CONFLICT_SIM_MIN,
   * CONFLICT_SIM_MAX] is the frozen AI-RUNTIME-002 heuristic (see the
   * band constants for the AI-RUNTIME-003 validation note). Very high
   * similarity = same content (agreement); very low similarity = unrelated
   * topics (no conflict). Only items above the conflict-relevance floor
   * participate.
   */
  private detectConflict(items: readonly EvidenceItem[], minRelevance: number): boolean {
    const onTopic = items.filter((item) => item.score >= minRelevance);
    for (let i = 0; i < onTopic.length - 1; i++) {
      for (let j = i + 1; j < onTopic.length; j++) {
        // Indexed access into the private, locally-built evidence array (never
        // attacker-controlled property names); the heuristic cannot see bounds.
        // eslint-disable-next-line security/detect-object-injection
        const a = onTopic[i];
        // eslint-disable-next-line security/detect-object-injection
        const b = onTopic[j];
        if (a === undefined || b === undefined) continue;
        if (a.source === b.source) continue;
        const sim = similarity(a.content, b.content);
        if (sim >= CONFLICT_SIM_MIN && sim <= CONFLICT_SIM_MAX) {
          return true;
        }
      }
    }
    return false;
  }
}
