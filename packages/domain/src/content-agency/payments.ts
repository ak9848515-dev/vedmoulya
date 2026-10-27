// ──────────────────────────────────────────────────────────────────
// VedMoulya — Payment Money & Evidence Primitives
// MISSION 002 (2026-10-26) — revenue safety hardening.
//
// WHY THIS FILE EXISTS
// --------------------
// Payments used to be arbitrary `double precision` numbers with no
// idempotency key and no evidence: two identical `addPayment` calls
// double-counted revenue, and an empty note counted as "proof" that money
// arrived. This module is the single deterministic home for the rules that
// fix that, shared by the application service (packages/services) and the
// PostgreSQL adapter (services/content-agency):
//
//   • money is represented in INTEGER MINOR UNITS (see toMinorUnits);
//     settlement never adds binary floats;
//   • a payment carries typed EVIDENCE, validated against the payment
//     method, never "any non-empty string";
//   • a verified payment (operator-reviewed evidence) is the ONLY thing
//     that supports a claim of received revenue.
//
// Everything here is pure and synchronous, so both adapters and the tests
// apply exactly the same rules.
// ──────────────────────────────────────────────────────────────────

// ── Money ──────────────────────────────────────────────────────────────────

/** Monetary scale used by invoice/payment amounts. 2 = cents. */
export const MONEY_MINOR_SCALE = 2;

/** Hard ceiling for a single amount: 1 trillion major units (1e14 minor). */
export const MONEY_MINOR_MAX = 100_000_000_000_000;

/**
 * Tolerance used when turning a JS number into integer minor units. JSON
 * amounts arrive as IEEE-754 doubles, so 1234.56 * 100 is 123456.00000000001.
 * The tolerance is only a *validation* aid — the value that is persisted and
 * settled is the integer produced here, never the float.
 */
const MINOR_EPSILON = 1e-6;

export type MinorUnitResult =
  | { ok: true; minor: number }
  | {
      ok: false;
      code: 'AMOUNT_INVALID' | 'AMOUNT_PRECISION' | 'AMOUNT_OUT_OF_RANGE';
      error: string;
    };

/**
 * Convert a major-unit amount (e.g. 1234.56) into integer minor units.
 * Rejects anything that cannot be represented exactly at scale 2 rather than
 * silently rounding it: a payment of 10.005 is ambiguous and must be
 * corrected by the operator, not guessed by the machine.
 */
export function toMinorUnits(amount: number): MinorUnitResult {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, code: 'AMOUNT_INVALID', error: 'Payment amount must be a finite number.' };
  }
  if (amount < 0) {
    return { ok: false, code: 'AMOUNT_INVALID', error: 'Payment amount cannot be negative.' };
  }
  const scaled = amount * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > MINOR_EPSILON) {
    return {
      ok: false,
      code: 'AMOUNT_PRECISION',
      error: `Payment amount ${String(amount)} has more than ${String(MONEY_MINOR_SCALE)} decimal places; amounts are stored in minor units and are never silently rounded.`,
    };
  }
  if (rounded > MONEY_MINOR_MAX) {
    return {
      ok: false,
      code: 'AMOUNT_OUT_OF_RANGE',
      error: 'Payment amount exceeds the supported maximum.',
    };
  }
  return { ok: true, minor: rounded };
}

/** Integer minor units back to a major-unit number (display / DTO boundary). */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/** Format integer minor units as a fixed-scale decimal string, no float math. */
export function formatMinorUnits(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(minor));
  const major = Math.floor(abs / 100);
  const fraction = abs % 100;
  return `${sign}${String(major)}.${String(fraction).padStart(2, '0')}`;
}

/** ISO-4217-ish currency normalization. Missing currency is USD (legacy default). */
export function normalizeCurrency(currency: string | undefined | null): string {
  const value = (currency ?? '').trim().toUpperCase();
  return value === '' ? 'USD' : value;
}

export function isValidCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

// ── Payment evidence ───────────────────────────────────────────────────────

/**
 * `processor_reference` — the payment came through a processor / bank and the
 *   operator has a transaction identifier.
 * `manual_receipt` — there is no processor (cash, cheque, direct transfer);
 *   the operator reviewed a physical/electronic receipt and records its
 *   reference plus who reviewed it.
 */
export type PaymentEvidenceKind = 'processor_reference' | 'manual_receipt';

export interface PaymentEvidence {
  kind: PaymentEvidenceKind;
  /** Real transaction id, bank reference, or receipt number. Never free text. */
  reference: string;
  /** Operator who reviewed the evidence. Required for manual receipts. */
  reviewedBy?: string;
  /** When the evidence was reviewed (ISO timestamp). Defaults to receipt time. */
  reviewedAt?: string;
}

/**
 * recorded — the payment row exists and carries evidence that an operator has
 *            NOT attested to. It is money *claimed*, not money *verified*.
 * verified — an operator reviewed the evidence. Only verified payments count
 *            as received revenue and only they can settle an invoice.
 */
export type PaymentStatus = 'recorded' | 'verified';

export const MANUAL_PAYMENT_METHODS = ['cash', 'cheque', 'check', 'manual', 'other'] as const;

/** Methods that have no processor behind them and therefore need a receipt. */
export function isManualPaymentMethod(method: string): boolean {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(method.trim().toLowerCase());
}

/**
 * Values that are obviously not evidence. Compared case-insensitively after
 * stripping non-alphanumerics, so "n/a", "N.A." and "na" are all rejected.
 */
const PLACEHOLDER_TOKENS = new Set([
  'test',
  'testing',
  'testpayment',
  'sample',
  'example',
  'dummy',
  'fake',
  'placeholder',
  'todo',
  'tbd',
  'na',
  'none',
  'null',
  'undefined',
  'unknown',
  'abc',
  'abc123',
  'xyz',
  'xxx',
  'xxxx',
  'ref',
  'reference',
  'txn',
  'txnid',
  'transaction',
  'transactionid',
  'manual',
  'pending',
  'paid',
  'received',
  'cash',
  'cheque',
  'check',
]);

const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._:/#-]{5,199}$/;
/** A repeated character run (aaaaaa / 000000) is not a reference. */
const REPEATED_RE = /^(.)\1{5,}$/;

function placeholderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlaceholder(value: string): boolean {
  const key = placeholderKey(value);
  if (key === '') return true;
  return PLACEHOLDER_TOKENS.has(key);
}

/**
 * Validate an operator identity used to attest payment evidence. A reviewer is
 * an accountable human/role, never a placeholder.
 */
export function validateReviewerIdentity(
  value: string | undefined | null,
): { ok: true; reviewerId: string } | { ok: false; code: string; error: string } {
  const reviewerId = (value ?? '').trim();
  if (reviewerId.length < 2 || reviewerId.length > 120) {
    return {
      ok: false,
      code: 'EVIDENCE_REVIEWER_INVALID',
      error: 'Evidence reviewer must be an operator identity of 2-120 characters.',
    };
  }
  if (isPlaceholder(reviewerId)) {
    return {
      ok: false,
      code: 'EVIDENCE_REVIEWER_INVALID',
      error: `"${reviewerId}" is not an operator identity.`,
    };
  }
  return { ok: true, reviewerId };
}

export interface ValidatedPaymentEvidence {
  kind: PaymentEvidenceKind;
  reference: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  status: PaymentStatus;
}

export type EvidenceValidation =
  { ok: true; evidence: ValidatedPaymentEvidence } | { ok: false; code: string; error: string };

/**
 * Validate payment evidence against the payment method.
 *
 * `reserved` are values that must never be accepted as a "reference" because
 * they are just an echo of the payload (invoice id, client id, amount, date).
 * This is what stops `reference: invoiceId` from counting as proof.
 */
export function validatePaymentEvidence(input: {
  evidence: PaymentEvidence | undefined;
  method: string;
  reserved: readonly string[];
}): EvidenceValidation {
  const evidence = input.evidence;
  if (!evidence || typeof evidence !== 'object') {
    return {
      ok: false,
      code: 'PAYMENT_EVIDENCE_REQUIRED',
      error:
        'Payment evidence is required: record the processor transaction reference, or a reviewed manual receipt reference. A payment is never recorded on a bare amount.',
    };
  }
  // Runtime shape check on the untyped boundary value (the declared type is
  // narrower than what JSON callers can actually send).
  const rawKind: unknown = (evidence as { kind?: unknown }).kind;
  if (rawKind !== 'processor_reference' && rawKind !== 'manual_receipt') {
    return {
      ok: false,
      code: 'EVIDENCE_KIND_INVALID',
      error: 'Payment evidence kind must be "processor_reference" or "manual_receipt".',
    };
  }

  const method = input.method.trim().toLowerCase();
  const manualMethod = isManualPaymentMethod(method);
  if (manualMethod) {
    if (evidence.kind !== 'manual_receipt') {
      return {
        ok: false,
        code: 'EVIDENCE_KIND_METHOD_MISMATCH',
        error: `Payment method "${method}" has no processor behind it — record a reviewed manual receipt (kind "manual_receipt") instead of a processor reference.`,
      };
    }
  } else if (evidence.kind === 'manual_receipt') {
    return {
      ok: false,
      code: 'EVIDENCE_KIND_METHOD_MISMATCH',
      error: `Payment method "${method}" settles through a processor — record the transaction reference (kind "processor_reference"), not a manual receipt.`,
    };
  }

  // `reference` is required by the type, but this runs on untyped JSON input
  // at the API boundary, so the runtime shape is checked rather than assumed.
  const rawReference: unknown = (evidence as { reference?: unknown }).reference;
  const reference =
    typeof rawReference === 'string' ? rawReference.trim().replace(/\s+/g, ' ') : '';
  if (reference === '') {
    return {
      ok: false,
      code: 'EVIDENCE_REFERENCE_REQUIRED',
      error: 'Payment evidence needs a transaction reference or receipt number.',
    };
  }
  if (!REFERENCE_RE.test(reference) || REPEATED_RE.test(reference.replace(/[\s._:/#-]/g, ''))) {
    return {
      ok: false,
      code: 'EVIDENCE_REFERENCE_INVALID',
      error:
        'Payment evidence reference is not a plausible transaction id or receipt number (expected 6-200 characters of letters, digits and . _ : / # -).',
    };
  }
  if (isPlaceholder(reference)) {
    return {
      ok: false,
      code: 'EVIDENCE_REFERENCE_PLACEHOLDER',
      error: `"${reference}" is a placeholder, not payment evidence.`,
    };
  }
  const referenceKey = placeholderKey(reference);
  for (const value of input.reserved) {
    if (value.trim() !== '' && placeholderKey(value) === referenceKey) {
      return {
        ok: false,
        code: 'EVIDENCE_REFERENCE_ECHOES_PAYLOAD',
        error:
          'Payment evidence reference merely repeats a value from the payment payload; it must be an independent transaction id or receipt number.',
      };
    }
  }

  const reviewedByRaw = (evidence.reviewedBy ?? '').trim();
  if (reviewedByRaw !== '') {
    const reviewer = validateReviewerIdentity(reviewedByRaw);
    if (!reviewer.ok) return reviewer;
  }
  if (evidence.kind === 'manual_receipt' && reviewedByRaw === '') {
    return {
      ok: false,
      code: 'EVIDENCE_REVIEW_REQUIRED',
      error:
        'A manual receipt is only evidence once an operator has reviewed it — supply reviewedBy.',
    };
  }

  return {
    ok: true,
    evidence: {
      kind: evidence.kind,
      reference,
      reviewedBy: reviewedByRaw === '' ? null : reviewedByRaw,
      reviewedAt: reviewedByRaw === '' ? null : (evidence.reviewedAt ?? null),
      // Only an operator attestation turns a claim into a verified payment.
      status: reviewedByRaw === '' ? 'recorded' : 'verified',
    },
  };
}

// ── Idempotency ────────────────────────────────────────────────────────────

/** Longest accepted idempotency key (matches the varchar(200) column). */
export const IDEMPOTENCY_KEY_MAX = 200;

export type IdempotencyKeyResult =
  | { ok: true; key: string; derived: boolean }
  | { ok: false; code: 'IDEMPOTENCY_KEY_INVALID'; error: string };

/**
 * Resolve the idempotency key for a payment.
 *
 * An explicit key always wins (a retry must reuse it verbatim). When the
 * caller supplies none, the evidence reference is the natural key: the same
 * receipt or processor transaction can only ever be recorded once, which is
 * exactly the retry-safety the mission asks for. Payments without a reference
 * never reach this point — evidence is mandatory.
 */
export function resolveIdempotencyKey(input: {
  idempotencyKey?: string;
  evidenceReference: string;
  evidenceKind: PaymentEvidenceKind;
}): IdempotencyKeyResult {
  const explicit = (input.idempotencyKey ?? '').trim();
  if (explicit !== '') {
    if (explicit.length > IDEMPOTENCY_KEY_MAX || !/^[\x21-\x7E]+$/.test(explicit)) {
      return {
        ok: false,
        code: 'IDEMPOTENCY_KEY_INVALID',
        error: `Idempotency key must be 1-${String(IDEMPOTENCY_KEY_MAX)} printable ASCII characters with no spaces.`,
      };
    }
    return { ok: true, key: explicit, derived: false };
  }
  const derived = `${input.evidenceKind}:${placeholderKey(input.evidenceReference)}`;
  if (derived.length > IDEMPOTENCY_KEY_MAX) {
    return {
      ok: false,
      code: 'IDEMPOTENCY_KEY_INVALID',
      error: 'Derived idempotency key is too long; supply an explicit idempotencyKey.',
    };
  }
  return { ok: true, key: derived, derived: true };
}

/**
 * Deterministic 64-bit fingerprint of the payment's identifying details.
 * Used to tell "same request retried" apart from "same key, different money".
 * Not a security primitive — conflicts are additionally checked field by
 * field — so a pure-JS hash keeps this module free of Node built-ins.
 */
export function paymentDetailsFingerprint(parts: readonly string[]): string {
  const payload = parts.join('\u0000');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i += 1) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
  }
  const length = payload.length.toString(16).padStart(4, '0');
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}${length}`;
}
