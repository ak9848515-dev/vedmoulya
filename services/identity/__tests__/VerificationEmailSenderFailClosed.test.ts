// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PROD-03: Verification email delivery must FAIL CLOSED
//
// Contract under test (services/identity/src/auth/VerificationEmailSender.ts):
//   • production/staging defaults to SMTP and NEVER silently falls back to the
//     log sender (a production log is not a delivery channel, and the
//     verification link carries a single-use credential);
//   • the explicit EMAIL_DELIVERY_MODE=log escape is honoured in any mode;
//   • development/test keep the log sender as the default;
//   • UnavailableVerificationEmailSender (the sender the gateway auth app uses
//     when production delivery is misconfigured) rejects on send without ever
//     writing the verification link anywhere.
//
// No real credentials or network I/O are involved.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  LogVerificationEmailSender,
  UnavailableVerificationEmailSender,
  createVerificationEmailSender,
} from '../src/auth/VerificationEmailSender.js';

vi.mock('@vedmoulya/core', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const EMAIL_ENV_KEYS = [
  'NODE_ENV',
  'EMAIL_DELIVERY_MODE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'SMTP_FROM',
  'EMAIL_FROM_NAME',
] as const;

const saved = new Map<string, string | undefined>(EMAIL_ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Wipe every email-delivery variable so each case starts from nothing set. */
function clearEmailEnv(): void {
  for (const key of EMAIL_ENV_KEYS) delete process.env[key];
}

describe('createVerificationEmailSender — production defaults', () => {
  it('throws (never returns the log sender) when production has no SMTP configuration', () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'production';

    expect(() => createVerificationEmailSender()).toThrow(/SMTP_HOST/);
  });

  it('throws when production has SMTP_HOST/PORT but no EMAIL_FROM', () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.prod.internal';
    process.env.SMTP_PORT = '587';

    expect(() => createVerificationEmailSender()).toThrow(/EMAIL_FROM/);
  });

  it('staging behaves exactly like production', () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'staging';

    expect(() => createVerificationEmailSender()).toThrow(/SMTP_HOST/);
  });

  it('honours the explicit EMAIL_DELIVERY_MODE=log escape in production', () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_DELIVERY_MODE = 'log';

    // The escape is EXPLICIT operator intent — it is never a silent fallback.
    expect(createVerificationEmailSender()).toBeInstanceOf(LogVerificationEmailSender);
  });

  it('development and test keep log delivery as the default', () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'development';
    expect(createVerificationEmailSender()).toBeInstanceOf(LogVerificationEmailSender);

    clearEmailEnv();
    process.env.NODE_ENV = 'test';
    expect(createVerificationEmailSender()).toBeInstanceOf(LogVerificationEmailSender);
  });
});

describe('UnavailableVerificationEmailSender (fail-closed production sender)', () => {
  it('rejects on send with an actionable, value-free error', async () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'production';
    const sender = new UnavailableVerificationEmailSender(
      'Email delivery misconfigured: SMTP_HOST and SMTP_PORT are required when EMAIL_DELIVERY_MODE=smtp',
    );

    await expect(
      sender.sendVerificationEmail({
        to: 'person@example.com',
        displayName: 'Person',
        verificationLink: 'https://app.vedmoulya.com/verify-email?token=SECRET-TOKEN',
      }),
    ).rejects.toThrow(/Email delivery unavailable/);
  });

  it('names the required variables and the explicit escape without echoing the link', async () => {
    clearEmailEnv();
    process.env.NODE_ENV = 'production';
    const sender = new UnavailableVerificationEmailSender();

    const error = await sender
      .sendVerificationEmail({
        to: 'person@example.com',
        displayName: 'Person',
        verificationLink: 'https://app.vedmoulya.com/verify-email?token=SECRET-TOKEN',
      })
      .then(
        () => null,
        (caught: unknown) => caught as Error,
      );

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('SMTP_HOST');
    expect(message).toContain('EMAIL_FROM');
    expect(message).toContain('APP_URL');
    expect(message).toContain('EMAIL_DELIVERY_MODE=log');
    // The credential-bearing link must never appear in the failure message.
    expect(message).not.toContain('SECRET-TOKEN');
    expect(message).not.toContain('app.vedmoulya.com/verify-email');
  });
});
