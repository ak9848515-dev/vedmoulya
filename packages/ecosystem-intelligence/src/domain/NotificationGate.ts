// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// NotificationGate — EPIC-015
//
// The existing AI World bell surfaces ONLY meaningful events — never
// one notification per ecosystem change. Every notification is
// relevance-scored; below the threshold it is silently dropped.
// ──────────────────────────────────────────────────────────────────

import type {
  IntelligenceNotification,
  IntelligenceNotificationKind,
} from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

/** Events the gate will ever surface. Anything else is noise by construction. */
const MEANINGFUL_KINDS: ReadonlySet<IntelligenceNotificationKind> = new Set([
  'BETTER_PROVIDER_DISCOVERED',
  'NEW_FREE_MODEL',
  'FREE_QUOTA_INCREASED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_RETIRED',
  'USEFUL_GITHUB_PROJECT',
  'SECURITY_WARNING',
  'LICENSE_CONCERN',
  'LOCAL_MODEL_SUITABLE',
  'PAID_TOOL_MATERIALLY_BETTER',
  'CONFIGURED_PROVIDER_CHANGED',
  'NEW_OPPORTUNITY',
]);

export const MIN_MEANINGFUL_RELEVANCE = 60;

export class NotificationGate {
  private sequence = 0;

  constructor(private readonly clock: ClockPort) {}

  maybeNotify(opts: {
    kind: IntelligenceNotificationKind;
    title: string;
    body: string;
    relevance: number;
    itemId?: string;
  }): IntelligenceNotification | undefined {
    if (!MEANINGFUL_KINDS.has(opts.kind)) return undefined;
    if (opts.relevance < MIN_MEANINGFUL_RELEVANCE) return undefined;
    this.sequence += 1;
    return {
      id: `ntf-${this.sequence}`,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      relevance: opts.relevance,
      itemId: opts.itemId,
      createdAt: this.clock.now(),
    };
  }
}
