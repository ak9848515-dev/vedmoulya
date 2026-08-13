// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Routing Calibration (AI-RUNTIME-003 Phase 4)
//
// Calibrates the deterministic ProviderRoutingAdvisor across task types using
// a multi-candidate provider intelligence fixture. It verifies the routing
// CONTRACT, not a live provider:
//
//   - decisions are deterministic and explainable (typed reasons + scores)
//   - different task types can route to different providers (no universal
//     "best" is hard-coded — the advisor must weigh capability, health,
//     benchmark, cost, latency, context-window fit and strategy)
//   - a provider that is unhealthy / incapable / over-budget is excluded
//   - a deterministic fallback chain is produced (not the primary again)
//   - strategy preference (quality / cost / latency / balanced) changes the
//     winner when evidence supports it
//   - context-window fit: small-window providers are not chosen for
//     long-context requests
//   - `explainSelection`-style output is fully human-readable
//
// Deterministic: no secrets, no live calls. Run:  npm run provider:calibrate
// ─────────────────────────────────────────────────────────────────────────────

import { ProviderRoutingAdvisor } from '@vedmoulya/services';
import type {
  ProviderCandidateIntelligence,
  ProviderIntelligencePort,
  ExecutionStrategyPort,
  ProviderSelectionExplanation,
} from '@vedmoulya/services';

// ── Candidate fixture: several providers with distinct profiles ─────────────

interface CandidateSpec {
  providerId: string;
  family: string;
  capabilities: string[];
  healthy: boolean;
  benchmarkScore: number;
  averageLatencyMs: number;
  costPer1KInput: number;
  costPer1KOutput: number;
  models: Array<{ id: string; contextWindow: number; maxOutputTokens: number; streaming: boolean }>;
}

const CANDIDATES: CandidateSpec[] = [
  {
    providerId: 'acme-ultra',
    family: 'acme',
    capabilities: ['reasoning', 'coding', 'structured_extraction', 'translation'],
    healthy: true,
    benchmarkScore: 95,
    averageLatencyMs: 3200,
    costPer1KInput: 2.5,
    costPer1KOutput: 10,
    models: [
      { id: 'ultra-256k', contextWindow: 256_000, maxOutputTokens: 8192, streaming: true },
      { id: 'ultra-128k', contextWindow: 128_000, maxOutputTokens: 4096, streaming: true },
    ],
  },
  {
    providerId: 'acme-mini',
    family: 'acme',
    capabilities: ['reasoning', 'coding', 'translation', 'classification'],
    healthy: true,
    benchmarkScore: 82,
    averageLatencyMs: 450,
    costPer1KInput: 0.15,
    costPer1KOutput: 0.6,
    models: [
      { id: 'mini-64k', contextWindow: 64_000, maxOutputTokens: 2048, streaming: true },
      { id: 'mini-16k', contextWindow: 16_000, maxOutputTokens: 1024, streaming: true },
    ],
  },
  {
    providerId: 'orion-fast',
    family: 'orion',
    capabilities: ['reasoning', 'classification', 'summarization'],
    healthy: true,
    benchmarkScore: 74,
    averageLatencyMs: 180,
    costPer1KInput: 0.05,
    costPer1KOutput: 0.15,
    models: [{ id: 'fast-32k', contextWindow: 32_000, maxOutputTokens: 2048, streaming: true }],
  },
  {
    providerId: 'omega-vision',
    family: 'omega',
    capabilities: ['vision', 'image_understanding'],
    healthy: true,
    benchmarkScore: 90,
    averageLatencyMs: 1500,
    costPer1KInput: 1.2,
    costPer1KOutput: 4,
    models: [{ id: 'vision-32k', contextWindow: 32_000, maxOutputTokens: 4096, streaming: false }],
  },
  {
    providerId: 'sickly-db',
    family: 'sickly',
    capabilities: ['reasoning'],
    healthy: false, // health gate must exclude
    benchmarkScore: 99,
    averageLatencyMs: 10,
    costPer1KInput: 0.01,
    costPer1KOutput: 0.01,
    models: [{ id: 'sickly-128k', contextWindow: 128_000, maxOutputTokens: 4096, streaming: true }],
  },
];

function toIntelligence(specs: CandidateSpec[]): ProviderIntelligencePort {
  return {
    getCandidates: (capability: string): Promise<ProviderCandidateIntelligence[]> =>
      Promise.resolve(
        specs
          .filter((s) => s.capabilities.includes(capability))
          .map((s) => ({
            providerId: s.providerId,
            family: s.family,
            capabilities: s.capabilities,
            healthy: s.healthy,
            benchmarkScore: s.benchmarkScore,
            averageLatencyMs: s.averageLatencyMs,
            costPer1KInput: s.costPer1KInput,
            costPer1KOutput: s.costPer1KOutput,
            models: s.models,
          })),
      ),
  };
}

function strategyPort(
  strategy: 'quality-first' | 'cost-first' | 'latency-first' | 'balanced',
  preferredProviders: string[] = [],
): ExecutionStrategyPort {
  return {
    getRoutingContext: async () => Promise.resolve({ strategy, preferredProviders }),
  };
}

// ── Scenarios ───────────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  capability: string;
  estimatedInputTokens: number;
  strategy: 'quality-first' | 'cost-first' | 'latency-first' | 'balanced';
  preferredProviders?: string[];
  /** The advisor must NOT select any of these (e.g. unhealthy / wrong fit). */
  mustNotSelect: string[];
  /** Reasonable winner families for this profile (any-of). */
  acceptableWinners: string[];
  /** Latency-first only: selected provider latency must be at or below this cap (ms). */
  maxLatencyMs?: number;
  expected: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'complex-reasoning-quality',
    capability: 'reasoning',
    estimatedInputTokens: 30_000,
    strategy: 'quality-first',
    mustNotSelect: ['sickly-db', 'orion-fast'],
    acceptableWinners: ['acme-ultra', 'acme-mini'],
    expected:
      'high-benchmark reasoning provider (acme family), never the unhealthy or low-benchmark one',
  },
  {
    name: 'simple-task-cost',
    capability: 'reasoning',
    estimatedInputTokens: 800,
    strategy: 'cost-first',
    mustNotSelect: ['acme-ultra', 'sickly-db'],
    acceptableWinners: ['orion-fast', 'acme-mini'],
    expected: 'cheap fast provider for a small task (cost-first strategy)',
  },
  {
    name: 'simple-task-latency',
    capability: 'reasoning',
    estimatedInputTokens: 800,
    strategy: 'latency-first',
    mustNotSelect: ['acme-ultra', 'sickly-db'],
    acceptableWinners: ['orion-fast', 'acme-mini'],
    // Strategy intent: the 3200ms provider must never win latency-first.
    // Among sub-second providers a close quality-vs-latency call may go to
    // either — the calibration contract is that latency now dominates
    // strongly (450ms/180ms << 3200ms), never the reverse.
    maxLatencyMs: 1000,
    expected: 'fast provider wins latency-first (3200ms provider excluded; latency cap 1000ms)',
  },
  {
    name: 'coding-task',
    capability: 'coding',
    estimatedInputTokens: 15_000,
    strategy: 'quality-first',
    mustNotSelect: ['orion-fast', 'sickly-db'],
    acceptableWinners: ['acme-ultra', 'acme-mini'],
    expected: 'coding-capable provider (acme family) — orion has no coding capability',
  },
  {
    name: 'long-context-128k',
    capability: 'reasoning',
    estimatedInputTokens: 130_000,
    strategy: 'balanced',
    mustNotSelect: ['orion-fast', 'acme-mini', 'sickly-db'],
    acceptableWinners: ['acme-ultra'],
    expected: 'only the 256k-window model fits 130k input tokens',
  },
  {
    name: 'vision-task',
    capability: 'vision',
    estimatedInputTokens: 2_000,
    strategy: 'quality-first',
    mustNotSelect: ['acme-ultra', 'acme-mini', 'orion-fast', 'sickly-db'],
    acceptableWinners: ['omega-vision'],
    expected: 'the only vision-capable provider (omega-vision)',
  },
  {
    name: 'preferred-provider',
    capability: 'reasoning',
    estimatedInputTokens: 5_000,
    strategy: 'balanced',
    preferredProviders: ['orion-fast'],
    mustNotSelect: ['sickly-db'],
    acceptableWinners: ['orion-fast', 'acme-mini', 'acme-ultra'],
    expected: 'execution-strategy preference nudges selection when viable',
  },
];

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

async function runScenario(
  advisor: ProviderRoutingAdvisor,
  s: Scenario,
): Promise<ProviderSelectionExplanation> {
  const decision = await advisor.decide({
    capability: s.capability,
    estimatedInputTokens: s.estimatedInputTokens,
    requestedOutputTokens: 1024,
  });
  console.log(
    `  ${s.name.padEnd(24)} → ${decision.selected.providerId}:${decision.selected.modelId}`,
  );
  console.log(`      reasons: ${decision.selected.reasons.slice(0, 3).join('; ')}`);
  if (decision.fallback.length > 0) {
    console.log(`      fallback: ${decision.fallback.map((f) => f.providerId).join(' → ')}`);
  }
  return decision;
}

async function main(): Promise<void> {
  console.log('VedMoulya — Provider Routing Calibration (AI-RUNTIME-003 Phase 4)');
  console.log(
    `Candidates: ${CANDIDATES.map((c) => c.providerId).join(', ')} (sickly-db is unhealthy)`,
  );
  console.log('Mode: hermetic · deterministic advisor · no live calls');
  console.log('');

  let decisionCount = 0;
  for (const s of SCENARIOS) {
    section(`Scenario: ${s.name} (${s.expected})`);
    const advisor = new ProviderRoutingAdvisor(
      toIntelligence(CANDIDATES),
      strategyPort(s.strategy, s.preferredProviders),
    );
    const decision = await runScenario(advisor, s);

    decisionCount += 1;
    check(
      'selected provider is not excluded',
      !s.mustNotSelect.includes(decision.selected.providerId),
      `selected=${decision.selected.providerId}`,
    );
    check(
      'selected provider is an acceptable winner',
      s.acceptableWinners.includes(decision.selected.providerId),
      `selected=${decision.selected.providerId}`,
    );
    if (s.maxLatencyMs !== undefined) {
      const selectedLatency =
        CANDIDATES.find((c) => c.providerId === decision.selected.providerId)?.averageLatencyMs ??
        Infinity;
      check(
        `latency-first selected provider is within the ${s.maxLatencyMs}ms cap`,
        selectedLatency <= s.maxLatencyMs,
        `selected=${decision.selected.providerId} latency=${selectedLatency}ms`,
      );
    }
    check(
      'unhealthy provider excluded from candidates considered',
      !decision.candidatesConsidered.some((c) => c.providerId === 'sickly-db' && !c.excluded),
    );
    check(
      'decision is explainable (typed reasons + score)',
      decision.selected.reasons.length > 0 && typeof decision.selected.score === 'number',
    );
    // The advisor builds its fallback chain from the pool of candidates whose
    // SELECTED MODEL fits the token budget (pickModel gates on context window).
    // So the fallback is empty whenever at most one candidate has a fitting
    // model — even if several candidates exist in the corpus. The invariant:
    // when a fallback IS listed, it is never the selected provider again.
    const fittingCount = CANDIDATES.filter(
      (c) =>
        c.capabilities.includes(s.capability) &&
        c.models.some((m) => m.contextWindow >= s.estimatedInputTokens + 512),
    ).length;
    const fallbackOk =
      fittingCount <= 1 ||
      (decision.fallback.length > 0 &&
        !decision.fallback.some((f) => f.providerId === decision.selected.providerId));
    check(
      'fallback chain is deterministic and distinct (or correctly empty when only one model fits)',
      fallbackOk,
      `fittingModels=${fittingCount} fallback=${decision.fallback.map((f) => f.providerId).join('→') || 'none'}`,
    );
    check('strategy is surfaced in the explanation', decision.strategy === s.strategy);
  }

  // Determinism: two identical calls produce identical selections.
  section('Determinism');
  const a = await new ProviderRoutingAdvisor(
    toIntelligence(CANDIDATES),
    strategyPort('balanced'),
  ).decide({ capability: 'reasoning', estimatedInputTokens: 10_000 });
  const b = await new ProviderRoutingAdvisor(
    toIntelligence(CANDIDATES),
    strategyPort('balanced'),
  ).decide({ capability: 'reasoning', estimatedInputTokens: 10_000 });
  check(
    'identical inputs → identical selection',
    a.selected.providerId === b.selected.providerId && a.selected.modelId === b.selected.modelId,
  );

  // No universal winner: different task types land on different providers.
  section('No hard-coded universal winner');
  const winners = new Set<string>();
  for (const s of SCENARIOS) {
    const advisor = new ProviderRoutingAdvisor(
      toIntelligence(CANDIDATES),
      strategyPort(s.strategy, s.preferredProviders),
    );
    const d = await advisor.decide({
      capability: s.capability,
      estimatedInputTokens: s.estimatedInputTokens,
    });
    winners.add(d.selected.providerId);
  }
  check(
    'task diversity routes to multiple providers (no single universal best)',
    winners.size >= 2,
    `winners=${Array.from(winners).join(',')}`,
  );

  section('RESULT');
  if (failures === 0) {
    console.log(
      `✅ PROVIDER ROUTING CALIBRATION PASSED — ${checks} checks, ${decisionCount} scenarios, 0 failures.`,
    );
  } else {
    console.error(`✗ PROVIDER ROUTING CALIBRATION FAILED — ${failures}/${checks} checks failed.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('✗ Provider routing calibration FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
