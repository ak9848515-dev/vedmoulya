// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Stripe Settlement Service
// Automated invoice payment via Stripe Checkout & cryptographic webhook settlement.
//
// INTEGRATION BOUNDARIES:
//   1. createCheckoutSession: prepares a hosted Stripe checkout session for an invoice.
//   2. verifyWebhookSignature: validates the HMAC SHA-256 signature against replay attacks.
//   3. handleWebhook: atomically records and settles invoices through ClientOperations.
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'node:crypto';
import type {
  ClientOperationsApplicationService,
  ContentAgencyApplicationService,
} from '@vedmoulya/services';
import { toMinorUnits, fromMinorUnits } from '@vedmoulya/domain';
import { logger } from '@vedmoulya/core';

export const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

export interface StripeConfig {
  secretKey?: string;
  webhookSecret?: string;
}

export function resolveStripeConfig(
  env: Record<string, string | undefined> = process.env,
): StripeConfig {
  return {
    secretKey: env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
  };
}

export interface CreateCheckoutSessionInput {
  userId: string;
  invoiceId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export type CreateCheckoutSessionResult =
  | { success: true; data: { checkoutUrl: string; sessionId: string } }
  | { success: false; code: string; message: string };

export interface StripeWebhookProcessingResult {
  received: boolean;
  handled: boolean;
  invoiceId?: string;
  settled?: boolean;
  message?: string;
}

export class StripePaymentService {
  private readonly config: StripeConfig;
  private readonly clientOps: ClientOperationsApplicationService;
  private readonly contentAgency: ContentAgencyApplicationService;
  private readonly fetchFn: typeof fetch;

  constructor(deps: {
    clientOps: ClientOperationsApplicationService;
    contentAgency: ContentAgencyApplicationService;
    config?: StripeConfig;
    fetchFn?: typeof fetch;
  }) {
    this.clientOps = deps.clientOps;
    this.contentAgency = deps.contentAgency;
    this.config = deps.config ?? resolveStripeConfig();
    this.fetchFn = deps.fetchFn ?? globalThis.fetch;
  }

  get isConfigured(): boolean {
    return Boolean(this.config.secretKey && this.config.webhookSecret);
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const invoiceResult = await this.contentAgency.getInvoice(input.userId, input.invoiceId);
    if (!invoiceResult.success || !invoiceResult.data) {
      return {
        success: false,
        code: 'INVOICE_NOT_FOUND',
        message: `Invoice ${input.invoiceId} not found for this user`,
      };
    }

    const invoice = invoiceResult.data;
    if (invoice.status === 'paid') {
      return {
        success: false,
        code: 'INVOICE_ALREADY_SETTLED',
        message: `Invoice ${input.invoiceId} is already paid`,
      };
    }

    const minorResult = toMinorUnits(invoice.amount);
    if (!minorResult.ok) {
      return {
        success: false,
        code: minorResult.code,
        message: minorResult.error,
      };
    }

    const currency = (invoice.currency || 'USD').toLowerCase();
    const successUrl =
      input.successUrl ??
      `https://app.vedmoulya.com/content-agency/invoices?paid=${input.invoiceId}`;
    const cancelUrl =
      input.cancelUrl ??
      `https://app.vedmoulya.com/content-agency/invoices?canceled=${input.invoiceId}`;

    // If Stripe secret key is not configured, generate a test/simulated checkout link
    if (!this.config.secretKey) {
      const mockSessionId = `cs_mock_${crypto.randomUUID()}`;
      return {
        success: true,
        data: {
          sessionId: mockSessionId,
          checkoutUrl: `/checkout/simulated?session_id=${mockSessionId}&invoice_id=${input.invoiceId}&amount=${String(invoice.amount)}`,
        },
      };
    }

    // Call official Stripe API
    try {
      const body = new URLSearchParams();
      body.append('mode', 'payment');
      body.append('success_url', successUrl);
      body.append('cancel_url', cancelUrl);
      body.append('client_reference_id', input.invoiceId);
      body.append('metadata[invoiceId]', input.invoiceId);
      body.append('metadata[userId]', input.userId);
      body.append('line_items[0][price_data][currency]', currency);
      body.append('line_items[0][price_data][unit_amount]', String(minorResult.minor));
      body.append(
        'line_items[0][price_data][product_data][name]',
        invoice.description || `Invoice ${input.invoiceId}`,
      );
      body.append('line_items[0][quantity]', '1');

      const response = await this.fetchFn(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('StripePaymentService: checkout creation failed', {
          status: response.status,
          error: errorText,
        });
        return {
          success: false,
          code: 'STRIPE_API_ERROR',
          message: `Stripe returned HTTP ${String(response.status)}: ${errorText}`,
        };
      }

      const json = (await response.json()) as { id: string; url: string };
      return {
        success: true,
        data: {
          sessionId: json.id,
          checkoutUrl: json.url,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        code: 'STRIPE_REQUEST_FAILED',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  verifyWebhookSignature(
    rawPayload: string,
    signatureHeader: string,
    webhookSecret?: string,
    toleranceSeconds = 300,
  ): boolean {
    const secret = webhookSecret ?? this.config.webhookSecret;
    if (!secret || !signatureHeader) return false;

    try {
      const parts = signatureHeader.split(',');
      let timestamp: string | undefined;
      const signatures: string[] = [];

      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k?.trim() === 't') timestamp = v?.trim();
        if (k?.trim() === 'v1' && v?.trim()) signatures.push(v.trim());
      }

      if (!timestamp || signatures.length === 0) return false;

      const timestampNum = parseInt(timestamp, 10);
      if (Number.isNaN(timestampNum)) return false;

      const now = Math.floor(Date.now() / 1000);
      if (toleranceSeconds > 0 && Math.abs(now - timestampNum) > toleranceSeconds) {
        logger.warn('StripePaymentService: signature timestamp outside tolerance window', {
          ageSeconds: now - timestampNum,
        });
        return false;
      }

      const signedPayload = `${timestamp}.${rawPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      return signatures.some((candidate) => {
        const candidateBuf = Buffer.from(candidate, 'utf8');
        if (candidateBuf.length !== expectedBuf.length) return false;
        return crypto.timingSafeEqual(candidateBuf, expectedBuf);
      });
    } catch (err: unknown) {
      logger.error('StripePaymentService: signature verification threw', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  async handleWebhook(
    rawPayload: string,
    signatureHeader: string,
  ): Promise<StripeWebhookProcessingResult> {
    if (!this.verifyWebhookSignature(rawPayload, signatureHeader)) {
      return {
        received: false,
        handled: false,
        message: 'Invalid signature',
      };
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      return {
        received: true,
        handled: false,
        message: 'Malformed JSON payload',
      };
    }

    const eventType = typeof event['type'] === 'string' ? event['type'] : '';
    const eventId = typeof event['id'] === 'string' ? event['id'] : `evt_${crypto.randomUUID()}`;
    const dataObj =
      typeof event['data'] === 'object' && event['data'] !== null
        ? ((event['data'] as Record<string, unknown>)['object'] as Record<string, unknown>)
        : undefined;

    if (!dataObj) {
      return { received: true, handled: false, message: 'No event data object found' };
    }

    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      const metadata = (dataObj['metadata'] ?? {}) as Record<string, unknown>;
      const invoiceId =
        (typeof metadata['invoiceId'] === 'string' && metadata['invoiceId']) ||
        (typeof dataObj['client_reference_id'] === 'string' && dataObj['client_reference_id']) ||
        undefined;
      const userId = (typeof metadata['userId'] === 'string' && metadata['userId']) || undefined;

      if (!invoiceId || !userId) {
        return {
          received: true,
          handled: false,
          message: 'Webhook missing invoiceId or userId in metadata',
        };
      }

      const rawAmount =
        typeof dataObj['amount_total'] === 'number'
          ? dataObj['amount_total']
          : typeof dataObj['amount'] === 'number'
            ? dataObj['amount']
            : 0;

      const currency =
        typeof dataObj['currency'] === 'string' ? dataObj['currency'].toUpperCase() : 'USD';
      const referenceId =
        (typeof dataObj['payment_intent'] === 'string' && dataObj['payment_intent']) ||
        (typeof dataObj['id'] === 'string' && dataObj['id']) ||
        eventId;

      const paymentResult = await this.clientOps.addPayment(userId, {
        invoiceId,
        amount: fromMinorUnits(rawAmount),
        currency,
        method: 'stripe',
        idempotencyKey: eventId,
        evidence: {
          kind: 'processor_reference',
          reference: referenceId,
          reviewedBy: 'stripe_webhook',
        },
        note: `Settled via Stripe webhook ${eventId}`,
      });

      if (!paymentResult.success) {
        logger.error('StripePaymentService: addPayment returned failure', {
          invoiceId,
          error: paymentResult.error,
        });
        return {
          received: true,
          handled: false,
          invoiceId,
          message: paymentResult.error,
        };
      }

      const settled = paymentResult.data !== undefined;
      logger.info('StripePaymentService: payment recorded and settled', {
        invoiceId,
        paymentId: paymentResult.data?.id,
        settled,
      });

      return {
        received: true,
        handled: true,
        invoiceId,
        settled,
      };
    }

    return {
      received: true,
      handled: false,
      message: `Ignored unhandled event type: ${eventType}`,
    };
  }
}
