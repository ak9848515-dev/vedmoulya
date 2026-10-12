// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · Commercial outcome reconciliation (S6.1)
//
// Deterministic, honest mapping from the CANONICAL content-agency invoice
// status to the boundary's commercial-outcome status. This never infers that a
// manually recorded payment proves money was received — only the canonical
// `paid` status maps to PAID.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_OUTCOME_INITIAL_STATUS,
  reconcileCommercialOutcomeStatus,
} from '../types/commercial-outcome-types.js';

describe('reconcileCommercialOutcomeStatus (S6.1)', () => {
  it('maps the canonical `paid` status to PAID — the only proof of receipt', () => {
    expect(reconcileCommercialOutcomeStatus('paid')).toBe('PAID');
  });

  it('maps `sent` to INVOICE_PENDING (awaiting human-recorded payment)', () => {
    expect(reconcileCommercialOutcomeStatus('sent')).toBe('INVOICE_PENDING');
  });

  it('maps `draft` to MANUAL_REVIEW (never treated as sent or paid)', () => {
    expect(reconcileCommercialOutcomeStatus('draft')).toBe('MANUAL_REVIEW');
  });

  it('exposes COMMERCIAL_PENDING as the only status this boundary may mint', () => {
    expect(COMMERCIAL_OUTCOME_INITIAL_STATUS).toBe('COMMERCIAL_PENDING');
  });
});
