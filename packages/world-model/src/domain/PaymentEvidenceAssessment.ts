// ──────────────────────────────────────────────────────────────────
// VedMoulya — Verified-payment evidence assessment
// MISSION 002 (2026-10-26).
//
// The `VERIFIED_PAYMENT` gate used to accept ANY non-empty text as proof that
// money arrived. "paid", "ok" and "done" all passed. This module is the shared
// assessment that keeps the gate honest without forcing the free-text world
// loop into Client Ops' structured evidence shape:
//
//   a real payment record identifies an AMOUNT and HOW it was paid —
//   a transaction reference (TXN-…, ch_…, UTR…) or a named method
//   (UPI, bank transfer, card, cash, cheque, …), or a receipt/invoice number.
//
// Client Ops (structured, operator-reviewed evidence) is stricter still; this
// is the floor the two paths now share.
// ──────────────────────────────────────────────────────────────────

const MIN_LENGTH = 12;

const AMOUNT_RE = /\d[\d,.]*/;

/** Named payment rails / instruments — naming one is "how it was paid". */
const METHOD_RE =
  /\b(upi|neft|imps|rtgs|ach|sepa|swift|wire|bank|transfer|card|visa|mastercard|amex|stripe|paypal|razorpay|paytm|phonepe|gpay|cheque|check|cash|paystack|flutterwave|wise|payoneer|deposit|receipt|invoice|txn|transaction|ref|reference)\b/i;

/** A transaction-looking token: >= 6 chars, contains a digit. */
const REFERENCE_RE = /\b(?=[A-Za-z0-9_-]{6,}\b)(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]+\b/;

const PLACEHOLDER_RE =
  /^(paid|done|ok|okay|yes|yep|received|received payment|payment|payment received|confirmed|verified|test|testing|sample|dummy|placeholder|todo|tbd|n\/a|na|none|null|unknown|xxx+)$/i;

export interface PaymentEvidenceAssessment {
  ok: boolean;
  /** Human-readable reason — surfaced verbatim by the gate. */
  reason: string;
}

/**
 * Assess free-text payment evidence. Deterministic and side-effect free.
 * `text` should already be sanitized by the caller's evidence pipeline; the
 * whitespace normalization here only guards direct calls.
 */
export function assessVerifiedPaymentEvidence(text: string): PaymentEvidenceAssessment {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length === 0) {
    return {
      ok: false,
      reason:
        'VERIFIED_PAYMENT requires the actual payment evidence (amount, method, reference) — a verified payment is never fabricated.',
    };
  }
  if (value.length < MIN_LENGTH || PLACEHOLDER_RE.test(value)) {
    return {
      ok: false,
      reason:
        'Payment evidence is not specific enough: record the amount plus a transaction reference or a named payment method (a bare "paid"/"ok" is not proof).',
    };
  }
  if (!AMOUNT_RE.test(value)) {
    return {
      ok: false,
      reason: 'Payment evidence must state the amount that was actually received.',
    };
  }
  if (!METHOD_RE.test(value) && !REFERENCE_RE.test(value)) {
    return {
      ok: false,
      reason:
        'Payment evidence must identify how the money arrived — a transaction reference or a named payment method (UPI, bank transfer, card, cash, cheque, …).',
    };
  }
  return {
    ok: true,
    reason: 'Payment evidence identifies an amount and a payment reference or method.',
  };
}
