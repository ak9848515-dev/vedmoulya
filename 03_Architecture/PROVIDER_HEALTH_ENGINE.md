# Provider Health Engine

> Continuous, real-time health monitoring of every AI provider — and automatic routing away from unhealthy ones.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Provider Health Engine: the component that continuously monitors provider availability, latency, API failures, rate limits, cost changes, version changes, and quotas — and feeds the Provider Rating Engine and automatic routing. Health is the real-time layer; benchmarks are the periodic layer.

## Responsibilities

- Monitor provider health signals continuously
- Maintain provider status (healthy/degraded/unstable/down — aligned with existing `ProviderStatus`)
- Detect cost and version changes
- Drive automatic routing decisions (with Provider Rating)
- Emit Health Specification

## Inputs

- Live probe results (health checks, synthetic probes)
- Call telemetry (latency, error rate, rate-limit events) — existing `ProviderHealth`/`ProviderStatistics`
- Pricing/version feeds (benchmark engine, registry updates)
- Incident signals (external status pages, error bursts)

## Outputs

- **Health Specification:** per provider — status, latency (p50/p95), error rate, rate-limit state, quota, last cost/version change, confidence, recommended routing posture
- Routing overrides (e.g., deprioritize during incident)

## Algorithms

### Availability

- Periodic probes (`isHealthy`, `getHealth` — existing adapter contract) + passive call success monitoring
- Sliding-window availability: `Avail(t) = successful / total` over window W
- Status mapping: ≥0.99 healthy · ≥0.95 degraded · ≥0.90 unstable · <0.90 down (thresholds registry-configurable)

### Latency

- p50/p95 from call telemetry, decay-weighted
- Latency anomaly: p95 > 2× rolling baseline → flag degraded latency
- Feeds `LatencyProfile` and routing (latency-first strategy)

### API failures

- Error classification by type (timeout, 4xx, 5xx, invalid_response, rate_limited)
- Error-rate threshold per type; bursts trigger circuit-breaker (open after N failures, half-open probe)
- Non-retryable errors recorded separately (learning signals)

### Rate limits

- Track `rateLimitRemaining`, `rateLimitReset` (existing types)
- Pre-call rate-limit check: if remaining below threshold, route elsewhere or throttle
- Backoff guidance (per retry policy)

### Cost changes

- Monitor provider pricing feeds (benchmark engine refresh, manual registry update)
- Price change → recompute Economy predictions; flag if a provider crosses a budget threshold
- Cost anomaly detection (billing spikes)

### Version changes

- Track model/provider version announcements
- Version change → schedule benchmark re-run for that provider; flag deprecation
- Routing continues on old version during transition (grace), then migrates

### Quota

- Track subscription/enterprise quotas per provider (requests, tokens, concurrent)
- Quota near-limit → deprioritize; quota exhausted → treat as unavailable for that window

### Automatic routing

- Health state maps to routing policy:
  - healthy → full participation in rating
  - degraded → latency/quality penalty in rating
  - unstable → deprioritize, only fallback
  - down → exclude; trigger fallback chain
- Circuit-breaker state persists with cooldown; manual override by ops

## Scoring

| Signal                   | Source   | Used for                            |
| ------------------------ | -------- | ----------------------------------- |
| Availability             | this doc | Status + rating input               |
| Latency/Cost/Reliability | this doc | Provider Score components (Math §1) |
| Routing posture          | this doc | Automatic routing                   |

## Decision Flow

1. Continuous collection (probes + telemetry + feeds)
2. Compute health signals per provider
3. Update Health Specification + rating inputs
4. Routing consumes: healthy providers participate; unhealthy fallback
5. Incidents → alerts + dashboards (Grafana/OTel)

## Failure Handling

- **Probe failure:** distinguish provider-down vs. probe-infra-down (cross-check passive telemetry)
- **Rate-limit burst:** back off locally; escalate to Brain if systemic
- **Cost change shock:** freeze routing for affected capability until benchmark revalidates
- **Stale telemetry:** decay confidence; blend toward last known + benchmark prior

## Learning

- Probe interval tuning (adaptive frequency by provider stability)
- Anomaly thresholds calibrated from history
- Incident-recovery patterns (how long until a provider recovers)

## Future Expansion

- Incident prediction (degradation leading indicators)
- Multi-region health aggregation
- External status-page integration

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [PROVIDER_BENCHMARK_ENGINE.md](./PROVIDER_BENCHMARK_ENGINE.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- `packages/ai/src/types/index.ts` (ProviderHealth, ProviderStatus, ProviderStatistics)
- `services/orchestrator/src/providers/*` (existing adapters)
