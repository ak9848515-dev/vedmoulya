// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S7.1 — Opportunity monitoring ports (acquisition MONITORING)
//
// S7.1 adds exactly two seams on top of the EXISTING S7.0 acquisition
// foundation. Neither adds a store, an engine, a lifecycle or a second
// opportunity model:
//
//   1. ExternalOpportunitySourcePort — the EXPLICIT, honest boundary to an
//      external marketplace. It is a SUPERSET of the existing
//      `OpportunitySourcePort` (same `name`, same `fetchCandidates()` shape)
//      plus a discriminated failure channel, because a scheduler-driven
//      monitor must be able to REPORT a source failure instead of throwing
//      into a timer. Failures are never converted into candidates: the
//      discriminated result has no candidate list on the failure arm.
//
//   2. OpportunityDiscoveryPort — the canonical `discover()` write. It is a
//      thin structural view of the EXISTING
//      `ActiveIntelligenceControlPlane.discoverOpportunityWithResult`, which
//      owns owner isolation and stable-key deduplication. Monitoring never
//      re-implements either.
//
// The normalizer (`normalizeExternalOpportunity`) and `RawExternalOpportunity`
// are IMPORTED from the existing `services/OpportunitySourceAdapter.js`. There
// is no second acquisition framework, no monitoring engine and no scraper.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ActiveIntelligenceControlPlane,
  OpportunityLifecycleRecord,
} from '@vedmoulya/control-plane';
import type { RawExternalOpportunity } from '../services/OpportunitySourceAdapter.js';

/**
 * The closed set of honest external-source failures. Each code maps onto an
 * existing platform ErrorCode at the transport boundary; the specific reason
 * is preserved in `details.opportunityCode` (same discipline as S7.0's
 * `acquisitionError`).
 */
export type ExternalSourceFailureCode =
  /** The source integration has no usable credential/configuration. */
  | 'SOURCE_NOT_CONFIGURED'
  /** The source rejected our credential (401/403). */
  | 'SOURCE_AUTH_FAILED'
  /** The source asked us to slow down (429). */
  | 'SOURCE_RATE_LIMITED'
  /** The request exceeded the bounded wall-clock budget. */
  | 'SOURCE_TIMEOUT'
  /** The source answered, but not in the shape its own API documents. */
  | 'MALFORMED_SOURCE_RESPONSE'
  /** The source is unreachable (DNS/TLS/connection/5xx). */
  | 'SOURCE_UNAVAILABLE'
  /** The requested capability is not authorized/available on this source. */
  | 'UNSUPPORTED_SOURCE_CAPABILITY'
  /** Any other transport-level failure — never silently swallowed. */
  | 'SOURCE_REQUEST_FAILED';

export interface ExternalSourceFailure {
  code: ExternalSourceFailureCode;
  /** Human-readable, secret-free explanation. */
  message: string;
  /** HTTP status when the source answered; absent for transport failures. */
  status?: number;
}

/** What one monitoring pass may obtain from an external source. */
export type ExternalCandidatesResult =
  | { success: true; candidates: RawExternalOpportunity[] }
  | ({ success: false } & ExternalSourceFailure);

/**
 * An external opportunity source. Structurally compatible with the EXISTING
 * `OpportunitySourcePort` (`name` + `fetchCandidates`), extended with an
 * honest, non-throwing result channel and a status view so monitoring can be
 * bounded and observable.
 *
 * A source adapter is a pure function of its transport: it is deliberately NOT
 * given the lifecycle, the approval authority, a Mission service or a
 * submission capability, so it STRUCTURALLY cannot bid, contact a client,
 * accept work or move money. Submission is not part of this interface and no
 * implementation of it exists (platform authorization is a prerequisite that
 * has not been established).
 */
export interface ExternalOpportunitySourcePort {
  /** Adapter identity — becomes the canonical `sourceRef.source`. */
  readonly name: string;
  /** Whether the source can actually be used right now (never a guess). */
  readonly status: {
    configured: boolean;
    /** Why it is (not) usable — secret-free. */
    reason: string;
  };
  /** Fetch permitted candidates. Failures are REPORTED, never faked. */
  fetchCandidates(): Promise<ExternalCandidatesResult>;
}

/** The canonical `discover()` input, minus the owner (the monitor supplies it). */
export interface CanonicalDiscoveryInput {
  ownerId: string;
  title: string;
  description: string;
  category: string;
  evidence: Array<{ label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' }>;
  estimatedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  estimatedEffort?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  sourceRef: { source: string; sourceReference: string };
  requiredCapabilities?: string[];
}

/**
 * The canonical discovery write. `created` reports whether this acquisition
 * CREATED a record or resolved idempotently to an existing one — the same
 * S7.0 report, surfaced through a seam so monitoring holds no lifecycle of
 * its own.
 */
export interface OpportunityDiscoveryPort {
  discoverWithResult(input: CanonicalDiscoveryInput): {
    record: OpportunityLifecycleRecord;
    created: boolean;
  };
}

/** Structural view of the EXISTING control plane (no new implementation). */
export type OpportunityDiscoveryPlane = Pick<
  ActiveIntelligenceControlPlane,
  'discoverOpportunityWithResult'
>;

/**
 * Adapt the EXISTING control plane to the monitoring discovery seam. Owner
 * isolation and stable-key deduplication stay entirely in the lifecycle — this
 * function copies nothing and overrides nothing.
 */
export function createOpportunityDiscoveryPort(
  plane: OpportunityDiscoveryPlane,
): OpportunityDiscoveryPort {
  return {
    discoverWithResult: (input) => plane.discoverOpportunityWithResult(input),
  };
}
