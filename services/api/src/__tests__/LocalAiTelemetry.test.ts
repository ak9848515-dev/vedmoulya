// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI telemetry bridge (browser → Local Agent → local runtime)
//
// The browser reaches its local agent directly, so the server never sees the
// execution. The browser reports the runtime's REAL usage through the
// authenticated `recordLocalAiUsage` bridge, which records it on the SAME
// owner-scoped trace → CostLedger spine the direct AI path uses.
//
// These tests prove: one AI call + real tokens are attributed to the owner,
// cost is honestly ZERO (never accepted from the caller), and no other user
// can see the usage.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll } from 'vitest';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { InMemoryApplicationRepository } from '@vedmoulya/app-factory';
import { InMemoryRequirementSessionStore } from '@vedmoulya/requirements';

beforeAll(() => {
  process.env.OPENAI_API_KEY = '';
  process.env.AI_OPENAI_API_KEY = '';
  process.env.AI_ANTHROPIC_API_KEY = '';
  process.env.AI_GOOGLE_API_KEY = '';
});

function makeService(): ApiApplicationService {
  return new ApiApplicationService({
    factoryRegistry: new InMemoryApplicationRepository(),
    requirementSessionStore: new InMemoryRequirementSessionStore(),
  });
}

describe('Local AI telemetry bridge — owner-scoped', () => {
  it('records one local execution with REAL tokens and zero cost', async () => {
    const svc = makeService();
    await svc.recordLocalAiUsage('local-owner', {
      provider: 'ollama',
      model: 'qwen2.5-coder:3b',
      input: 33,
      output: 3,
      total: 36,
      mode: 'local-agent',
    });

    const ledger = svc.ops.costLedger({ userId: 'local-owner' });
    expect(ledger.totals.aiCalls).toBe(1);
    expect(ledger.totals.tokensInput).toBe(33);
    expect(ledger.totals.tokensOutput).toBe(3);
    expect(ledger.totals.tokensTotal).toBe(36);
    // Local inference has no price: cost stays zero, never invented.
    expect(ledger.totals.costUsd).toBe(0);

    // The local execution is attributed to the local provider + model.
    expect(ledger.byProvider.some((p) => p.provider === 'ollama')).toBe(true);
    const execution = svc.traceProvider
      .listTraces({ userId: 'local-owner' })
      .flatMap((t) => t.spans)
      .find((s) => s.name === 'ai.provider_execution');
    expect(execution?.attributes.model).toBe('qwen2.5-coder:3b');
    expect(execution?.attributes.status).toBe('success');
  });

  it("never leaks one user's local usage into another user's ledger", async () => {
    const svc = makeService();
    await svc.recordLocalAiUsage('owner-a', {
      provider: 'ollama',
      model: 'qwen2.5-coder:3b',
      input: 10,
      output: 5,
    });

    expect(svc.ops.costLedger({ userId: 'owner-a' }).totals.tokensTotal).toBe(15);
    expect(svc.ops.costLedger({ userId: 'owner-b' }).totals.tokensTotal).toBe(0);
    expect(svc.ops.costLedger({ userId: 'owner-b' }).totals.aiCalls).toBe(0);
  });

  it('records the call honestly even when the runtime reported no tokens', async () => {
    const svc = makeService();
    await svc.recordLocalAiUsage('owner-zero', {
      provider: 'ollama',
      model: 'qwen2.5-coder:3b',
      input: 0,
      output: 0,
    });

    const ledger = svc.ops.costLedger({ userId: 'owner-zero' });
    // The execution DID happen — it is one call — but zero tokens is not dressed up.
    expect(ledger.totals.aiCalls).toBe(1);
    expect(ledger.totals.tokensTotal).toBe(0);
    expect(ledger.totals.costUsd).toBe(0);
  });

  it('clamps negative/absurd token input to zero instead of recording a false count', async () => {
    const svc = makeService();
    await svc.recordLocalAiUsage('owner-clamp', {
      provider: 'ollama',
      model: 'qwen2.5-coder:3b',
      input: -50,
      output: 7,
    });

    const ledger = svc.ops.costLedger({ userId: 'owner-clamp' });
    expect(ledger.totals.tokensInput).toBe(0);
    expect(ledger.totals.tokensOutput).toBe(7);
    expect(ledger.totals.tokensTotal).toBe(7);
  });
});
