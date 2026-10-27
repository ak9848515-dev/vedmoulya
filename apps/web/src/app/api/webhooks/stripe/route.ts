// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Stripe Webhook Route Handler (Next.js App Router)
// POST /api/webhooks/stripe
// Cryptographically verified webhook handling for automated invoice settlement.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server';
import { StripePaymentService } from '@vedmoulya/api';

type ApiModule = typeof import('@vedmoulya/api');

let apiPromise: Promise<ApiModule> | null = null;

function loadApi(): Promise<ApiModule> {
  if (!apiPromise) {
    apiPromise = import('@vedmoulya/api').catch((error: unknown) => {
      apiPromise = null;
      throw error;
    });
  }
  return apiPromise;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  try {
    const api = await loadApi();
    const { getServices, awaitAllEngineEnsureTables } = api;
    await awaitAllEngineEnsureTables();
    const services = getServices();

    const stripeService = new StripePaymentService({
      clientOps: services.clientOps,
      contentAgency: services.contentAgency,
    });

    const result = await stripeService.handleWebhook(rawBody, signature);

    if (!result.received && result.message === 'Invalid signature') {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    return NextResponse.json(
      { received: true, handled: result.handled, settled: result.settled },
      { status: 200 },
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal webhook processing error' },
      { status: 500 },
    );
  }
}
