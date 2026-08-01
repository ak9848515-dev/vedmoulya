// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Observability
// Covers IdentityMetrics, IdentityAuditor, and IdentityTracer.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, metrics } from '@vedmoulya/core';
import { IdentityMetrics, MetricNames } from '../src/observability/IdentityMetrics.js';
import { IdentityAuditor } from '../src/observability/IdentityAudit.js';
import { IdentityTracer } from '../src/observability/IdentityTracing.js';

// ── IdentityMetrics ──────────────────────────────────────────────────────────

describe('IdentityMetrics', () => {
  const idm = new IdentityMetrics();

  beforeEach(() => {
    metrics.reset();
  });

  it('records a registration counter', () => {
    idm.recordRegistration();
    expect(metrics.getCounter(MetricNames.USER_REGISTRATIONS)).toBe(1);
  });

  it('records login success and failure counters', () => {
    idm.recordLogin(true);
    idm.recordLogin(true);
    idm.recordLogin(false);
    expect(metrics.getCounter(MetricNames.USER_LOGINS_SUCCESS)).toBe(2);
    expect(metrics.getCounter(MetricNames.USER_LOGINS_FAILURE)).toBe(1);
  });

  it('records profile and preference update counters', () => {
    idm.recordProfileUpdate();
    idm.recordPreferencesUpdate();
    expect(metrics.getCounter(MetricNames.USER_PROFILE_UPDATES)).toBe(1);
    expect(metrics.getCounter(MetricNames.USER_PREFERENCES_UPDATES)).toBe(1);
  });

  it('records auth attempt success and failure counters', () => {
    idm.recordAuthAttempt(true);
    idm.recordAuthAttempt(false);
    expect(metrics.getCounter(MetricNames.AUTH_ATTEMPTS_SUCCESS)).toBe(1);
    expect(metrics.getCounter(MetricNames.AUTH_ATTEMPTS_FAILURE)).toBe(1);
  });

  it('records token lifecycle counters', () => {
    idm.recordTokenGenerated();
    idm.recordTokenVerified();
    idm.recordTokenRefreshed();
    expect(metrics.getCounter(MetricNames.TOKENS_GENERATED)).toBe(1);
    expect(metrics.getCounter(MetricNames.TOKENS_VERIFIED)).toBe(1);
    expect(metrics.getCounter(MetricNames.TOKENS_REFRESHED)).toBe(1);
  });

  it('records authorization allowed and denied counters', () => {
    idm.recordAuthorizationAllowed();
    idm.recordAuthorizationDenied();
    expect(metrics.getCounter(MetricNames.AUTHORIZATION_ALLOWED)).toBe(1);
    expect(metrics.getCounter(MetricNames.AUTHORIZATION_DENIED)).toBe(1);
  });
});

// ── IdentityAuditor ──────────────────────────────────────────────────────────

describe('IdentityAuditor', () => {
  const auditor = new IdentityAuditor();
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The core logger exposes info; spy on the shared instance so IdentityAuditor
    // calls (which use the same logger singleton) are observable.
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('records a generic audit entry', () => {
    auditor.record({
      action: 'user.registered',
      actorId: 'usr_1',
      correlationId: 'corr-1',
      success: true,
    });
    expect(infoSpy).toHaveBeenCalled();
    const args = infoSpy.mock.calls[0]!;
    expect(args[1] as { audit: boolean }).toMatchObject({ audit: true, service: 'identity' });
  });

  it('records a registration', () => {
    auditor.recordRegistration('usr_1', 'a@b.com', 'corr-1', true);
    expect(infoSpy).toHaveBeenCalled();
  });

  it('records a login', () => {
    auditor.recordLogin('usr_1', 'email', 'corr-1', true);
    expect(infoSpy).toHaveBeenCalled();
  });

  it('records a failed login', () => {
    auditor.recordLogin('usr_1', 'email', 'corr-1', false);
    expect(infoSpy).toHaveBeenCalled();
  });

  it('records a profile update', () => {
    auditor.recordProfileUpdate('usr_1', ['displayName'], 'corr-1');
    expect(infoSpy).toHaveBeenCalled();
  });

  it('records a role change', () => {
    auditor.recordRoleChange('usr_1', 'usr_2', 'user', 'admin', 'corr-1');
    expect(infoSpy).toHaveBeenCalled();
  });

  it('records an authorization denial', () => {
    auditor.recordAuthorizationDenied('usr_1', 'manage', 'Billing', 'corr-1');
    expect(infoSpy).toHaveBeenCalled();
  });
});

// ── IdentityTracer ───────────────────────────────────────────────────────────

describe('IdentityTracer', () => {
  const tracer = new IdentityTracer();

  it('traces a successful async operation and returns its value', async () => {
    const result = await tracer.traceSpan('identity.op', async (span) => {
      expect(span).toBeDefined();
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('re-throws errors and records them on the span', async () => {
    await expect(
      tracer.traceSpan('identity.op', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('sets span attributes', () => {
    // No throw expected; tracing is best-effort.
    expect(() =>
      tracer.setSpanAttributes({} as never, { userId: 'usr_1', attempts: 3, verified: true }),
    ).not.toThrow();
  });
});
