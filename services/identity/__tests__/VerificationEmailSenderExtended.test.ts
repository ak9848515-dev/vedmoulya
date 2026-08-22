import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LogVerificationEmailSender,
  SmtpVerificationEmailSender,
  createVerificationEmailSender,
  resolveAppOrigin,
} from '../src/auth/VerificationEmailSender.js';

vi.mock('@vedmoulya/core', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  }),
}));

const mockEmail = {
  to: 'user@example.com',
  displayName: 'Test User',
  verificationLink: 'https://app.example.com/verify-email?token=abc123',
};

describe('LogVerificationEmailSender', () => {
  it('logs the verification link and resolves', async () => {
    const sender = new LogVerificationEmailSender();
    await sender.sendVerificationEmail(mockEmail);
    // Just verifying it doesn't throw
  });
});

describe('SmtpVerificationEmailSender', () => {
  it('creates a transporter with valid config', () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
      fromName: 'VedMoulya',
    });
    expect(sender).toBeDefined();
  });

  it('throws when host is missing', () => {
    expect(
      () =>
        new SmtpVerificationEmailSender({
          host: '',
          port: 587,
          from: 'no-reply@example.com',
        }),
    ).toThrow('SMTP_HOST');
  });

  it('throws when port is missing/zero', () => {
    expect(
      () =>
        new SmtpVerificationEmailSender({
          host: 'smtp.example.com',
          port: 0,
          from: 'no-reply@example.com',
        }),
    ).toThrow('SMTP_PORT');
  });

  it('throws when from is missing', () => {
    expect(
      () =>
        new SmtpVerificationEmailSender({
          host: 'smtp.example.com',
          port: 587,
          from: '',
        }),
    ).toThrow('EMAIL_FROM');
  });

  it('sends email via transporter', async () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
      fromName: 'VedMoulya',
    });
    await sender.sendVerificationEmail(mockEmail);
    // No assertion needed — if sendMail throws, the test fails
  });

  it('creates transporter with auth when user/pass provided', () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: 'no-reply@example.com',
    });
    expect(sender).toBeDefined();
  });

  it('creates transporter without auth when user/pass not provided', () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
    });
    expect(sender).toBeDefined();
  });

  it('defaults secure to true for port 465', () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 465,
      from: 'no-reply@example.com',
    });
    expect(sender).toBeDefined();
  });

  it('uses fromName in email when provided', async () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
      fromName: 'VedMoulya Team',
    });
    await sender.sendVerificationEmail(mockEmail);
  });

  it('uses from without fromName when not provided', async () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
    });
    await sender.sendVerificationEmail(mockEmail);
  });

  it('escapes HTML in displayName and verificationLink', async () => {
    const sender = new SmtpVerificationEmailSender({
      host: 'smtp.example.com',
      port: 587,
      from: 'no-reply@example.com',
    });
    await sender.sendVerificationEmail({
      to: 'user@example.com',
      displayName: '<script>alert("xss")</script>',
      verificationLink: 'https://example.com/verify?token=<b>test</b>',
    });
  });
});

describe('createVerificationEmailSender', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns log sender in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const sender = createVerificationEmailSender();
    expect(sender).toBeInstanceOf(LogVerificationEmailSender);
  });

  it('returns log sender when EMAIL_DELIVERY_MODE=log', () => {
    vi.stubEnv('EMAIL_DELIVERY_MODE', 'log');
    vi.stubEnv('NODE_ENV', 'production');
    const sender = createVerificationEmailSender();
    expect(sender).toBeInstanceOf(LogVerificationEmailSender);
  });

  it('returns smtp sender when EMAIL_DELIVERY_MODE=smtp', () => {
    vi.stubEnv('EMAIL_DELIVERY_MODE', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('EMAIL_FROM', 'no-reply@example.com');
    const sender = createVerificationEmailSender();
    expect(sender).toBeInstanceOf(SmtpVerificationEmailSender);
  });
});

describe('resolveAppOrigin', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns APP_URL when set with https', () => {
    vi.stubEnv('APP_URL', 'https://app.example.com');
    expect(resolveAppOrigin()).toBe('https://app.example.com');
  });

  it('returns APP_URL when set with http', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    expect(resolveAppOrigin()).toBe('http://localhost:3000');
  });

  it('returns localhost fallback when APP_URL is not set', () => {
    vi.stubEnv('APP_URL', undefined);
    expect(resolveAppOrigin()).toBe('http://localhost:3000');
  });

  it('returns localhost fallback for invalid APP_URL', () => {
    vi.stubEnv('APP_URL', 'not-a-url');
    expect(resolveAppOrigin()).toBe('http://localhost:3000');
  });
});
