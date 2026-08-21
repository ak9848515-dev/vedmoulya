// ──────────────────────────────────────────────────────────────────
// VedMoulya — Verification Email Sender
// Minimal email-delivery port for the email-verification flow
// (SPRINT-045 — PRODUCTION EMAIL VERIFICATION).
//
// Two implementations:
//  - LogVerificationEmailSender — writes the verification link to the
//    application log. Used in development/test, and in production ONLY
//    when EMAIL_DELIVERY_MODE=log is explicitly set (the documented
//    local-certification escape — mirrors the AI_ENABLE_MOCK discipline;
//    production NEVER silently falls back to it).
//  - SmtpVerificationEmailSender — real delivery via nodemailer over SMTP
//    (env-only credentials). Production defaults to this and fails fast
//    when the required configuration is absent — email delivery is never
//    silently skipped.
// ──────────────────────────────────────────────────────────────────

import { createTransport, type Transporter } from 'nodemailer';
import { logger } from '@vedmoulya/core';

export interface VerificationEmail {
  to: string;
  displayName: string;
  verificationLink: string;
}

/** Port — the AuthService depends only on this. */
export interface VerificationEmailSender {
  sendVerificationEmail(message: VerificationEmail): Promise<void>;
}

// ── Log Sender (dev/test + explicit local certification) ────────────────

export class LogVerificationEmailSender implements VerificationEmailSender {
  sendVerificationEmail(message: VerificationEmail): Promise<void> {
    // The link is the whole point of this mode — it is NOT a secret (it IS
    // the delivery payload); only tokens/credentials are never logged.
    logger.info('EMAIL VERIFICATION (log delivery mode)', {
      to: message.to,
      displayName: message.displayName,
      verificationLink: message.verificationLink,
    });
    return Promise.resolve();
  }
}

// ── SMTP Sender (production) ────────────────────────────────────────────

export interface SmtpEmailConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  fromName?: string;
  secure?: boolean;
}

export class SmtpVerificationEmailSender implements VerificationEmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly fromName?: string;

  constructor(config: SmtpEmailConfig) {
    // Fail fast at construction: a misconfigured production sender must be
    // obvious, never a silently-unsent verification email.
    if (!config.host || !config.port) {
      throw new Error(
        'Email delivery misconfigured: SMTP_HOST and SMTP_PORT are required when EMAIL_DELIVERY_MODE=smtp',
      );
    }
    if (!config.from) {
      throw new Error(
        'Email delivery misconfigured: EMAIL_FROM is required when EMAIL_DELIVERY_MODE=smtp',
      );
    }
    this.from = config.from;
    this.fromName = config.fromName;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  async sendVerificationEmail(message: VerificationEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromName ? `"${this.fromName}" <${this.from}>` : this.from,
      to: message.to,
      subject: 'Verify your VedMoulya email',
      text: [
        `Hello ${message.displayName},`,
        '',
        'Welcome to VedMoulya. Verify your email address to activate your account:',
        '',
        message.verificationLink,
        '',
        'This link expires in 24 hours and can only be used once.',
        '',
        'If you did not create this account, you can safely ignore this email.',
      ].join('\n'),
      html: [
        '<p>Hello <strong>',
        escapeHtml(message.displayName),
        '</strong>,</p>',
        '<p>Welcome to VedMoulya. Verify your email address to activate your account:</p>',
        '<p><a href="',
        escapeHtml(message.verificationLink),
        '">Verify my email</a></p>',
        '<p>This link expires in 24 hours and can only be used once.</p>',
        '<p>If you did not create this account, you can safely ignore this email.</p>',
      ].join(''),
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Env-driven factory ───────────────────────────────────────────────────

export type EmailDeliveryMode = 'log' | 'smtp';

/**
 * Resolve the email sender from the environment.
 *
 * - `EMAIL_DELIVERY_MODE=log` → log sender (any environment; the explicit
 *   local-certification escape, documented in .env.example).
 * - `EMAIL_DELIVERY_MODE=smtp` → SMTP sender; missing required config throws
 *   (fail fast — never silently skip delivery).
 * - Unset → dev/test: log sender; production/staging: SMTP (so a production
 *   deployment without email configuration fails loudly, never silently).
 */
export function createVerificationEmailSender(): VerificationEmailSender {
  // Explicitly widened (string) — the web build's tsconfig types NODE_ENV as
  // a literal union without 'staging' (same widening as AuthService.signUp).
  const env: string = process.env.NODE_ENV ?? 'development';
  const mode: EmailDeliveryMode =
    (process.env.EMAIL_DELIVERY_MODE as EmailDeliveryMode | undefined) ??
    (env === 'production' || env === 'staging' ? 'smtp' : 'log');

  if (mode === 'log') {
    return new LogVerificationEmailSender();
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? '');
  return new SmtpVerificationEmailSender({
    host: host ?? '',
    port: Number.isFinite(port) && port > 0 ? port : NaN,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    // EMAIL_FROM is the canonical var; SMTP_FROM is the pre-existing documented
    // alias in the core config (packages/core/src/config) — accept both.
    from: process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? '',
    fromName: process.env.EMAIL_FROM_NAME,
  });
}

/**
 * Resolve the application origin used to build verification links
 * (`APP_URL` — the public base URL of the deployed web app).
 */
export function resolveAppOrigin(): string {
  const appUrl = process.env.APP_URL;
  if (appUrl && /^https?:\/\//.test(appUrl)) return appUrl;
  // Local fallback — only meaningful in development/local certification.
  return 'http://localhost:3000';
}
