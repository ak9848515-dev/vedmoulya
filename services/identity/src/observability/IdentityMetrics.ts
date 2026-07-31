// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Metrics
// Metrics instruments for identity operations monitoring
// ──────────────────────────────────────────────────────────────────

import { metrics } from '@vedmoulya/core';

/** Metric name constants for identity operations */
export const MetricNames = {
  USER_REGISTRATIONS: 'identity.user.registrations',
  USER_LOGINS_SUCCESS: 'identity.user.logins.success',
  USER_LOGINS_FAILURE: 'identity.user.logins.failure',
  USER_PROFILE_UPDATES: 'identity.user.profile.updates',
  USER_PREFERENCES_UPDATES: 'identity.user.preferences.updates',
  AUTH_ATTEMPTS_SUCCESS: 'identity.auth.attempts.success',
  AUTH_ATTEMPTS_FAILURE: 'identity.auth.attempts.failure',
  TOKENS_GENERATED: 'identity.tokens.generated',
  TOKENS_VERIFIED: 'identity.tokens.verified',
  TOKENS_REFRESHED: 'identity.tokens.refreshed',
  AUTHORIZATION_ALLOWED: 'identity.authz.allowed',
  AUTHORIZATION_DENIED: 'identity.authz.denied',
  ACTIVE_USERS: 'identity.users.active',
  SUSPENDED_USERS: 'identity.users.suspended',
} as const;

export class IdentityMetrics {
  recordRegistration(): void {
    try {
      metrics.increment(MetricNames.USER_REGISTRATIONS);
    } catch {
      /* noop */
    }
  }

  recordLogin(success: boolean): void {
    try {
      metrics.increment(
        success ? MetricNames.USER_LOGINS_SUCCESS : MetricNames.USER_LOGINS_FAILURE,
      );
    } catch {
      /* noop */
    }
  }

  recordProfileUpdate(): void {
    try {
      metrics.increment(MetricNames.USER_PROFILE_UPDATES);
    } catch {
      /* noop */
    }
  }

  recordPreferencesUpdate(): void {
    try {
      metrics.increment(MetricNames.USER_PREFERENCES_UPDATES);
    } catch {
      /* noop */
    }
  }

  recordAuthAttempt(success: boolean): void {
    try {
      metrics.increment(
        success ? MetricNames.AUTH_ATTEMPTS_SUCCESS : MetricNames.AUTH_ATTEMPTS_FAILURE,
      );
    } catch {
      /* noop */
    }
  }

  recordTokenGenerated(): void {
    try {
      metrics.increment(MetricNames.TOKENS_GENERATED);
    } catch {
      /* noop */
    }
  }

  recordTokenVerified(): void {
    try {
      metrics.increment(MetricNames.TOKENS_VERIFIED);
    } catch {
      /* noop */
    }
  }

  recordTokenRefreshed(): void {
    try {
      metrics.increment(MetricNames.TOKENS_REFRESHED);
    } catch {
      /* noop */
    }
  }

  recordAuthorizationAllowed(): void {
    try {
      metrics.increment(MetricNames.AUTHORIZATION_ALLOWED);
    } catch {
      /* noop */
    }
  }

  recordAuthorizationDenied(): void {
    try {
      metrics.increment(MetricNames.AUTHORIZATION_DENIED);
    } catch {
      /* noop */
    }
  }
}
