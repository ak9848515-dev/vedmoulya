// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5 — Opportunity source adapter (acquisition FOUNDATION)
//
// A source adapter answers exactly ONE question:
//
//     "What opportunity did we discover?"
//
// It does NOT answer "should we accept it?" and it owns NO decision power:
//   • it never approves, never scores into a verdict, never transitions state
//   • it never creates a Mission, never bids, quotes, sends or spends
//   • it never fetches a URL — external text arrives already in hand
//
// It normalizes UNTRUSTED external input into the EXISTING canonical contract
// (`OpportunityLifecycleRecord` via the control plane's `discover`). There is
// no OpportunityV2, no AcquisitionOpportunity, no FreelanceOpportunity: the
// canonical model is the pre-existing one and the source normalizes INTO it.
//
// Secrets are a HARD REJECT, not a strip. A source payload that carries a
// credential is evidence the adapter (or the transport feeding it) is being
// misused; silently deleting the secret would launder a leak into a clean
// record and hide the incident.
// ─────────────────────────────────────────────────────────────────────────────

import type { OpportunitySourceRef } from '@vedmoulya/control-plane';

/** What an external source adapter may hand us. Everything is untrusted. */
export interface RawExternalOpportunity {
  /** Adapter identity, e.g. 'manual-import', 'rss-feed'. */
  source: string;
  /** Source-native id or canonical URL — the dedup discriminator. */
  sourceReference: string;
  title: string;
  description: string;
  category?: string;
  /** Free-form requirements as the source stated them. */
  requirements?: string[];
  /** Verbatim source URL, retained as provenance only — NEVER fetched. */
  url?: string;
  /** Amount as a LABEL with its evidence status — never a bare number. */
  estimatedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  estimatedEffort?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  automationPotential?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
}

/** The canonical `discover()` input this adapter produces. */
export interface NormalizedOpportunity {
  sourceRef: OpportunitySourceRef;
  title: string;
  description: string;
  category: string;
  evidence: Array<{ label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' }>;
  estimatedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  estimatedEffort?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  /** Capabilities the source stated the work needs — qualification input. */
  requiredCapabilities?: string[];
  /** The verbatim URL, when the source gave one. Provenance only. */
  url?: string;
}

export type NormalizeResult =
  | { success: true; data: NormalizedOpportunity }
  | { success: false; code: string; message: string };

// ── Secret detection ─────────────────────────────────────────────────────────
// Patterns for credentials that must NEVER enter an opportunity record. These
// are checked across every free-text field of the payload.
const SECRET_PATTERNS: ReadonlyArray<{ code: string; re: RegExp }> = [
  { code: 'SECRET_BEARER_TOKEN', re: /\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/i },
  {
    code: 'SECRET_AUTHORIZATION_HEADER',
    re: /\b(authorization|proxy-authorization)\b\s*[:=]/i,
  },
  { code: 'SECRET_COOKIE', re: /\b(set-cookie|cookie)\b\s*[:=]/i },
  {
    code: 'SECRET_SESSION_TOKEN',
    re: /\b(token|session[_-]?token|refresh[_-]?token|id[_-]?token|access[_-]?token)\b\s*[:=]/i,
  },
  {
    code: 'SECRET_API_KEY',
    re: /\b(api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*\S/i,
  },
  { code: 'SECRET_PASSWORD', re: /\b(password|passwd|pwd)\b\s*[:=]\s*\S/i },
  {
    code: 'SECRET_DATABASE_URL',
    re: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]*:[^\s@]*@/i,
  },
];

/** A labelled value may legitimately CONTAIN the word "value"/"effort"; the
 *  patterns above only fire on `key: value` shapes, so a bare amount is safe. */
function findSecret(fields: ReadonlyArray<[string, string]>): string | undefined {
  for (const [field, text] of fields) {
    for (const { code, re } of SECRET_PATTERNS) {
      if (re.test(text)) return `${code} in "${field}"`;
    }
  }
  return undefined;
}

// ── Sanitization ─────────────────────────────────────────────────────────────
// Mirrors the EXISTING world-model evidence sanitizer (scripts/markup/control
// characters stripped, length-bounded). Sanitization is NOT a security
// boundary by itself; the secret rejection above is the hard control.
/** Drop C0/C1 control characters by code point. A `/[\x00-\x1f]/` pattern
 *  would express the same thing, but stripping control characters is exactly
 *  the intent here, so comparing code points states it directly and needs no
 *  lint escape hatch. */
function stripControlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    if (code >= 0x80 && code <= 0x9f) continue;
    out += ch;
  }
  return out;
}

export function sanitizeSourceText(text: string, maxLength = 2000): string {
  return stripControlChars(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const IDENT_RE = /^[A-Za-z0-9._:@/?#[\]!$&'()*+,;=%-]+$/;

/** Normalize one raw external payload into the canonical contract. */
export function normalizeExternalOpportunity(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      success: false,
      code: 'MALFORMED_SOURCE_INPUT',
      message: 'Source payload must be an object.',
    };
  }
  const r = raw as Record<string, unknown>;

  const source = typeof r.source === 'string' ? r.source.trim() : '';
  const sourceReference = typeof r.sourceReference === 'string' ? r.sourceReference.trim() : '';
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  const description = typeof r.description === 'string' ? r.description.trim() : '';

  if (source.length === 0 || sourceReference.length === 0) {
    return {
      success: false,
      code: 'SOURCE_REFERENCE_REQUIRED',
      message: 'source and sourceReference are required — they are the dedup discriminator.',
    };
  }
  if (title.length === 0) {
    return { success: false, code: 'TITLE_REQUIRED', message: 'title is required.' };
  }
  if (description.length === 0) {
    return { success: false, code: 'DESCRIPTION_REQUIRED', message: 'description is required.' };
  }

  const requirements = Array.isArray(r.requirements)
    ? r.requirements.filter((q): q is string => typeof q === 'string').slice(0, 25)
    : [];
  // The source's stated requirements ARE the capability requirements. They are
  // carried separately (not only as prose evidence) because capability fit is
  // the one qualification axis that must be machine-comparable.
  const requiredCapabilities = Array.from(
    new Set(
      requirements
        .map((q) => sanitizeSourceText(q, 60))
        .filter((q) => q.length > 0)
        .map((q) => q.toLowerCase()),
    ),
  ).slice(0, 20);
  const rawUrl = typeof r.url === 'string' ? r.url.trim() : '';

  // Hard secret rejection across EVERY free-text field before anything is kept.
  const secretFields: Array<[string, string]> = [
    ['title', title],
    ['description', description],
    ['source', source],
    ['sourceReference', sourceReference],
    ['url', rawUrl],
  ];
  requirements.forEach((q, i) => {
    secretFields.push([`requirements[${i}]`, q]);
  });
  for (const [key, field] of [
    ['estimatedValue', r.estimatedValue],
    ['estimatedEffort', r.estimatedEffort],
  ] as const) {
    if (field && typeof field === 'object') {
      const raw = (field as Record<string, unknown>).label;
      secretFields.push([`${key}.label`, typeof raw === 'string' ? raw : '']);
    }
  }
  const secret = findSecret(secretFields);
  if (secret !== undefined) {
    return {
      success: false,
      code: 'SECRET_REJECTED',
      message: `Refused to store an opportunity carrying a credential: ${secret}.`,
    };
  }

  // A URL is retained as provenance ONLY. It is never fetched by this layer,
  // and an obviously non-URL or credential-bearing value never lands.
  let url: string | undefined;
  if (rawUrl.length > 0) {
    if (!/^https?:\/\//i.test(rawUrl) || rawUrl.length > 2048) {
      return {
        success: false,
        code: 'MALFORMED_SOURCE_URL',
        message: 'url must be an http(s) URL of at most 2048 characters.',
      };
    }
    url = rawUrl;
  }

  // Deterministic sourceRef. Both halves are restricted to identifier
  // characters so a crafted reference can never forge a different owner scope.
  const safeSource = source.slice(0, 64);
  const safeRef = sourceReference.slice(0, 512);
  if (!IDENT_RE.test(safeSource) || !IDENT_RE.test(safeRef)) {
    return {
      success: false,
      code: 'MALFORMED_SOURCE_INPUT',
      message: 'source/sourceReference may only contain identifier characters.',
    };
  }

  const evidence: Array<{ label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' }> = [
    { label: `Discovered via ${safeSource}`, status: 'VERIFIED' },
  ];
  for (const q of requirements.slice(0, 5)) {
    evidence.push({ label: sanitizeSourceText(q, 120), status: 'UNKNOWN' });
  }

  const label = (
    v: unknown,
  ): { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' } | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const text = typeof o.label === 'string' ? sanitizeSourceText(o.label, 120) : '';
    if (text.length === 0) return undefined;
    const status =
      o.status === 'VERIFIED' || o.status === 'ESTIMATED' || o.status === 'UNKNOWN'
        ? o.status
        : 'UNKNOWN';
    return { label: text, status };
  };

  const estimatedValue = label(r.estimatedValue);
  const estimatedEffort = label(r.estimatedEffort);

  return {
    success: true,
    data: {
      sourceRef: { source: safeSource, sourceReference: safeRef },
      title: sanitizeSourceText(title, 160),
      description: sanitizeSourceText(description, 1000),
      category:
        typeof r.category === 'string' && r.category.trim().length > 0
          ? sanitizeSourceText(r.category, 80)
          : 'external',
      evidence,
      ...(estimatedValue !== undefined ? { estimatedValue } : {}),
      ...(estimatedEffort !== undefined ? { estimatedEffort } : {}),
      riskLevel:
        r.riskLevel === 'LOW' || r.riskLevel === 'MEDIUM' || r.riskLevel === 'HIGH'
          ? r.riskLevel
          : 'UNKNOWN',
      automationPotential:
        r.automationPotential === 'HIGH' ||
        r.automationPotential === 'MEDIUM' ||
        r.automationPotential === 'LOW'
          ? r.automationPotential
          : 'UNKNOWN',
      ...(requiredCapabilities.length > 0 ? { requiredCapabilities } : {}),
      ...(url !== undefined ? { url } : {}),
    },
  };
}

/** A source adapter is a pure function of its transport — it is intentionally
 *  NOT given the lifecycle, the approval authority or any Mission service, so
 *  it structurally cannot acquire decision power. */
export interface OpportunitySourcePort {
  readonly name: string;
  /** Returns raw, untrusted payloads. It never returns a verdict. */
  fetchCandidates(): Promise<RawExternalOpportunity[]>;
}

/** Import a batch through a source adapter. Deterministic order, no dedup
 *  system of its own — the canonical lifecycle's stable key does the work. */
export async function collectCandidates(port: OpportunitySourcePort): Promise<NormalizeResult[]> {
  const raw = await port.fetchCandidates();
  const results: NormalizeResult[] = [];
  for (const item of raw) {
    results.push(normalizeExternalOpportunity(item));
  }
  return results;
}
