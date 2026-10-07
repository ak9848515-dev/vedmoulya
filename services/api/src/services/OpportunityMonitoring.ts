// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S7.1 — Opportunity monitoring (bounded, idempotent discovery pass)
//
// ONE bounded pass per owner. It composes EXISTING machinery and owns no
// engine, no loop, no store and no scheduler:
//
//   external source  →  normalize (EXISTING normalizer + secret gate)
//                    →  relevance filter (the owner's EXISTING control settings)
//                    →  discover (EXISTING canonical lifecycle = dedup + owner isolation)
//                    →  DISCOVERED
//
// Guarantees enforced here, not by convention:
//   • IDEMPOTENT — the canonical stable key (owner + source + sourceReference)
//     collapses repeated polling onto ONE record. A second pass reports
//     `created: 0` and touches no lifecycle state.
//   • BOUNDED — candidates per pass and the accepted response size are capped;
//     network fetches are cached for a short window so N monitored owners cost
//     ONE source request per pass instead of N.
//   • HONEST — a source failure is REPORTED and ingests NOTHING. There is no
//     path where a failure becomes a candidate or an empty-but-successful run.
//   • NO COMMITMENT — the only state reachable from here is DISCOVERED. This
//     module is not given (and cannot reach) an approval authority, a Mission
//     service, a bidding/submission capability or a payment path. It never
//     qualifies, approaches or commits to anyone.
// ─────────────────────────────────────────────────────────────────────────────

import {
  normalizeExternalOpportunity,
  type NormalizedOpportunity,
} from './OpportunitySourceAdapter.js';
import type {
  CanonicalDiscoveryInput,
  ExternalOpportunitySourcePort,
  ExternalSourceFailure,
  OpportunityDiscoveryPort,
} from '../infrastructure/OpportunityMonitoringPorts.js';

/** Bounded default: candidates examined per owner per pass. */
const DEFAULT_MAX_CANDIDATES_PER_PASS = 25;
/** Hard cap — a misconfigured caller can never turn this into a crawl. */
const MAX_CANDIDATES_HARD_CAP = 100;
/** Rejected-item detail sample kept on the result (the COUNT is always exact). */
const REJECTED_SAMPLE_LIMIT = 5;
/** Short-lived source cache so N monitored owners cost ONE request per pass. */
const DEFAULT_CACHE_TTL_MS = 60_000;

/** The owner's EXISTING control-plane autonomy settings (read-only slice). */
export interface OpportunityMonitoringSettings {
  /** Categories the system may propose. Empty/absent = all allowed. */
  allowedCategories?: string[] | undefined;
  /** Categories never proposed. */
  prohibitedCategories?: string[] | undefined;
}

export interface OpportunityMonitoringDeps {
  /** Absent → monitoring is honestly disabled; no request is attempted. */
  source?: ExternalOpportunitySourcePort | undefined;
  /** The EXISTING canonical discovery write (owner isolation + dedup). */
  discovery: OpportunityDiscoveryPort;
  /** The owner's EXISTING settings, or undefined when none are stored. */
  settings?: ((ownerId: string) => OpportunityMonitoringSettings | undefined) | undefined;
  /** Clock injection (ISO string) for hermetic tests. */
  now?: (() => string) | undefined;
  /** Candidates examined per pass (clamped 1..100, default 25). */
  maxCandidatesPerPass?: number | undefined;
  /** Source-cache window in ms (0 disables the cache). */
  cacheTtlMs?: number | undefined;
}

/** Outcome of ONE bounded monitoring pass. Aggregate + honest — never fabricated. */
export interface OpportunityMonitoringResult {
  source: string;
  /** Whether the source could be used at all (credential/configuration). */
  sourceConfigured: boolean;
  startedAt: string;
  finishedAt: string;
  /** Candidates the source returned (before normalization or filtering). */
  candidatesFetched: number;
  /** Candidates that normalized into the canonical contract. */
  normalized: number;
  /** NEW canonical opportunities created this pass (idempotent first pass only). */
  created: number;
  /** Candidates that already existed — the dedup proof. */
  existing: number;
  /** Candidates skipped by the owner's configured category policy. */
  filtered: number;
  /** Candidates refused by the EXISTING normalizer (still counted, never stored). */
  rejected: number;
  /** Bounded detail sample of the rejections (exact `rejected` count above). */
  rejectedSample: Array<{ code: string; message: string }>;
  /** Canonical ids CREATED this pass, in deterministic source order. */
  createdIds: string[];
  /** Set when the pass stopped at the candidate bound (fail-closed). */
  truncated: boolean;
  /** True when this pass reused a source response cached earlier in the window. */
  usedCachedCandidates: boolean;
  /** Present ONLY on an honest source failure. Nothing was ingested. */
  failure?: ExternalSourceFailure;
}

export interface OpportunityMonitor {
  /** Run ONE bounded pass for `ownerId`. Never throws; failures are reported. */
  monitor(ownerId: string): Promise<OpportunityMonitoringResult>;
}

/** Case/normalization-insensitive token test used for the category policy. */
function matchesAny(haystack: string, needles: readonly string[]): boolean {
  const lowered = haystack.toLowerCase();
  return needles.some((needle) => {
    const token = needle.trim().toLowerCase();
    return token !== '' && lowered.includes(token);
  });
}

/**
 * Apply the owner's EXISTING category policy to a normalized candidate.
 * Semantics match `AutonomySettings.allowedCategories` ("empty = all allowed")
 * and `prohibitedCategories` ("never proposed"). Capability names stated by the
 * source are matched too, because on a marketplace the meaningful category is
 * usually expressed as a skill.
 */
export function isWithinCategoryPolicy(
  opportunity: NormalizedOpportunity,
  settings: OpportunityMonitoringSettings | undefined,
): boolean {
  if (settings === undefined) return true;
  const matchable = [
    opportunity.category,
    opportunity.title,
    ...(opportunity.requiredCapabilities ?? []),
  ].join(' \u0000 ');
  const prohibited = settings.prohibitedCategories ?? [];
  if (prohibited.length > 0 && matchesAny(matchable, prohibited)) return false;
  const allowed = settings.allowedCategories ?? [];
  if (allowed.length === 0) return true;
  return matchesAny(matchable, allowed);
}

/**
 * Map the EXISTING normalizer's output onto the canonical discovery input. This
 * is the SAME mapping the S7.0 import path performs — it adds nothing to the
 * contract. The one addition is a provenance EVIDENCE line carrying the source
 * URL: the canonical record has no URL field, and evidence is the existing,
 * auditable provenance channel (capped at 8 entries by the lifecycle).
 */
export function toDiscoveryInput(
  ownerId: string,
  normalized: NormalizedOpportunity,
): CanonicalDiscoveryInput {
  const evidence = [...normalized.evidence];
  if (normalized.url !== undefined && evidence.length < 8) {
    evidence.push({ label: `Source URL: ${normalized.url}`, status: 'VERIFIED' });
  }
  return {
    ownerId,
    title: normalized.title,
    description: normalized.description,
    category: normalized.category,
    evidence,
    ...(normalized.estimatedValue !== undefined
      ? { estimatedValue: normalized.estimatedValue }
      : {}),
    ...(normalized.estimatedEffort !== undefined
      ? { estimatedEffort: normalized.estimatedEffort }
      : {}),
    riskLevel: normalized.riskLevel,
    automationPotential: normalized.automationPotential,
    sourceRef: normalized.sourceRef,
    ...(normalized.requiredCapabilities !== undefined
      ? { requiredCapabilities: normalized.requiredCapabilities }
      : {}),
  };
}

export function createOpportunityMonitor(deps: OpportunityMonitoringDeps): OpportunityMonitor {
  const maxCandidates = Math.max(
    1,
    Math.min(MAX_CANDIDATES_HARD_CAP, deps.maxCandidatesPerPass ?? DEFAULT_MAX_CANDIDATES_PER_PASS),
  );
  const now = deps.now ?? ((): string => new Date().toISOString());
  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  // The source is fixed at construction. Capturing it once lets the closures
  // below use it without a non-null assertion.
  const sourcePort = deps.source;

  // Per-process source cache. It exists so a heartbeat that monitors many
  // owners issues ONE upstream request per window rather than one per owner —
  // it is a traffic bound, not a second scheduler: when it expires the next
  // pass simply asks the source again.
  let cache:
    | {
        atMs: number;
        result: Awaited<ReturnType<ExternalOpportunitySourcePort['fetchCandidates']>>;
      }
    | undefined;

  const loadCandidates = async (
    source: ExternalOpportunitySourcePort,
  ): Promise<{
    result: Awaited<ReturnType<ExternalOpportunitySourcePort['fetchCandidates']>>;
    cached: boolean;
  }> => {
    const atMs = Date.parse(now());
    if (
      cacheTtlMs > 0 &&
      cache !== undefined &&
      Number.isFinite(atMs) &&
      atMs - cache.atMs < cacheTtlMs
    ) {
      return { result: cache.result, cached: true };
    }
    const result = await source.fetchCandidates();
    if (cacheTtlMs > 0) cache = { atMs, result };
    return { result, cached: false };
  };

  return {
    async monitor(ownerId: string): Promise<OpportunityMonitoringResult> {
      const startedAt = now();
      const source = sourcePort;
      const result: OpportunityMonitoringResult = {
        source: source?.name ?? 'none',
        sourceConfigured: source?.status.configured ?? false,
        startedAt,
        finishedAt: startedAt,
        candidatesFetched: 0,
        normalized: 0,
        created: 0,
        existing: 0,
        filtered: 0,
        rejected: 0,
        rejectedSample: [],
        createdIds: [],
        truncated: false,
        usedCachedCandidates: false,
      };

      if (source === undefined) {
        result.failure = {
          code: 'SOURCE_NOT_CONFIGURED',
          message: 'No external opportunity source is configured — monitoring is disabled.',
        };
        result.finishedAt = now();
        return result;
      }

      let fetched: Awaited<ReturnType<ExternalOpportunitySourcePort['fetchCandidates']>>;
      let cached: boolean;
      try {
        ({ result: fetched, cached } = await loadCandidates(source));
      } catch (error) {
        // A source implementation that throws instead of returning a
        // discriminated failure must still not crash the heartbeat — and must
        // still never look like success.
        result.failure = {
          code: 'SOURCE_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown source failure.',
        };
        result.finishedAt = now();
        return result;
      }
      result.usedCachedCandidates = cached;

      if (!fetched.success) {
        // Honest failure: NOTHING is ingested, nothing is fabricated.
        result.failure = {
          code: fetched.code,
          message: fetched.message,
          ...(fetched.status !== undefined ? { status: fetched.status } : {}),
        };
        result.finishedAt = now();
        return result;
      }

      const all = fetched.candidates;
      result.candidatesFetched = all.length;
      result.truncated = all.length > maxCandidates;
      const settings = deps.settings?.(ownerId);

      for (const candidate of all.slice(0, maxCandidates)) {
        const normalized = normalizeExternalOpportunity(candidate);
        if (!normalized.success) {
          result.rejected += 1;
          if (result.rejectedSample.length < REJECTED_SAMPLE_LIMIT) {
            result.rejectedSample.push({ code: normalized.code, message: normalized.message });
          }
          continue;
        }
        result.normalized += 1;
        if (!isWithinCategoryPolicy(normalized.data, settings)) {
          result.filtered += 1;
          continue;
        }
        // The ONLY write: the EXISTING canonical discovery. Owner isolation and
        // deduplication are the lifecycle's, so a repeat pass creates nothing.
        const { record, created } = deps.discovery.discoverWithResult(
          toDiscoveryInput(ownerId, normalized.data),
        );
        if (created) {
          result.created += 1;
          result.createdIds.push(record.id);
        } else {
          result.existing += 1;
        }
      }

      result.finishedAt = now();
      return result;
    },
  };
}
