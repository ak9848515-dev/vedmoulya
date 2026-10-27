import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { StripePaymentService } from '../services/StripePaymentService.js';
import type {
  ClientOperationsApplicationService,
  ContentAgencyApplicationService,
} from '@vedmoulya/services';

describe('StripePaymentService', () => {
  const secretKey = 'sk_test_123';
  const webhookSecret = 'whsec_test_secret_key';

  const mockContentAgency = {
    getInvoice: vi.fn(),
  } as unknown as ContentAgencyApplicationService;

  const mockClientOps = {
    addPayment: vi.fn(),
  } as unknown as ClientOperationsApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates simulated checkout session in mock/dev mode when secret key is omitted', async () => {
    const service = new StripePaymentService({
      clientOps: mockClientOps,
      contentAgency: mockContentAgency,
      config: {},
    });

    vi.mocked(mockContentAgency.getInvoice).mockResolvedValue({
      success: true,
      data: {
        id: 'inv_123',
        invoiceNumber: 'INV-001',
        amount: 250.0,
        currency: 'USD',
        status: 'sent',
      } as any,
    });

    const result = await service.createCheckoutSession({
      userId: 'user_1',
      invoiceId: 'inv_123',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sessionId).toContain('cs_mock_');
    expect(result.data.checkoutUrl).toContain('/checkout/simulated');
    expect(result.data.checkoutUrl).toContain('inv_123');
  });

  it('refuses checkout session for already paid invoice', async () => {
    const service = new StripePaymentService({
      clientOps: mockClientOps,
      contentAgency: mockContentAgency,
      config: { secretKey, webhookSecret },
    });

    vi.mocked(mockContentAgency.getInvoice).mockResolvedValue({
      success: true,
      data: {
        id: 'inv_paid',
        amount: 100.0,
        status: 'paid',
      } as any,
    });

    const result = await service.createCheckoutSession({
      userId: 'user_1',
      invoiceId: 'inv_paid',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('INVOICE_ALREADY_SETTLED');
  });

  it('correctly verifies valid HMAC SHA-256 webhook signatures', () => {
    const service = new StripePaymentService({
      clientOps: mockClientOps,
      contentAgency: mockContentAgency,
      config: { secretKey, webhookSecret },
    });

    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');

    const header = `t=${timestamp},v1=${signature}`;
    const isValid = service.verifyWebhookSignature(payload, header);
    expect(isValid).toBe(true);
  });

  it('rejects tampered webhook payloads or expired timestamps', () => {
    const service = new StripePaymentService({
      clientOps: mockClientOps,
      contentAgency: mockContentAgency,
      config: { secretKey, webhookSecret },
    });

    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');

    const header = `t=${timestamp},v1=${signature}`;

    // Tampered payload
    expect(service.verifyWebhookSignature(payload + 'extra', header)).toBe(false);

    // Old timestamp (10 minutes ago, exceeds 300s window)
    const oldTimestamp = timestamp - 600;
    const oldSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${oldTimestamp}.${payload}`, 'utf8')
      .digest('hex');
    const oldHeader = `t=${oldTimestamp},v1=${oldSignature}`;
    expect(service.verifyWebhookSignature(payload, oldHeader)).toBe(false);
  });

  it('processes checkout.session.completed and records payment through ClientOps', async () => {
    const service = new StripePaymentService({
      clientOps: mockClientOps,
      contentAgency: mockContentAgency,
      config: { secretKey, webhookSecret },
    });

    const eventId = 'evt_test_checkout_123';
    const payloadObj = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_live_123',
          payment_intent: 'pi_live_456',
          amount_total: 50000, // 500.00 USD
          currency: 'usd',
          metadata: {
            invoiceId: 'inv_abc',
            userId: 'user_xyz',
          },
        },
      },
    };

    const rawPayload = JSON.stringify(payloadObj);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawPayload}`, 'utf8')
      .digest('hex');
    const header = `t=${timestamp},v1=${signature}`;

    vi.mocked(mockClientOps.addPayment).mockResolvedValue({
      success: true,
      data: {
        id: 'pay_123',
        status: 'verified',
      } as any,
    });

    const result = await service.handleWebhook(rawPayload, header);
    expect(result.received).toBe(true);
    expect(result.handled).toBe(true);
    expect(result.invoiceId).toBe('inv_abc');
    expect(result.settled).toBe(true);

    expect(mockClientOps.addPayment).toHaveBeenCalledWith('user_xyz', {
      invoiceId: 'inv_abc',
      amount: 500,
      currency: 'USD',
      method: 'stripe',
      idempotencyKey: eventId,
      evidence: {
        kind: 'processor_reference',
        reference: 'pi_live_456',
        reviewedBy: 'stripe_webhook',
      },
      note: `Settled via Stripe webhook ${eventId}`,
    });
  });
});
