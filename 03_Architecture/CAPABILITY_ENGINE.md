# Capability Engine

> The engine that defines, registers, versions, scores, and composes capabilities.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Capability Engine: the authoritative registry and runtime resolver for everything the platform can do. Capabilities are the stable contract between business modules and the EI layer (aligned with the existing `packages/ai` taxonomy). The engine handles lifecycle, metadata, dependency graphs, ownership, scoring, discovery, composition, and versioning.

## Responsibilities

- Define capability model and lifecycle
- Maintain the capability registry (metadata, dependencies, versions)
- Score capabilities (Capability Score)
- Support discovery and composition
- Resolve task → capability at runtime

## Inputs

- Capability taxonomy (`packages/ai`: reasoning, coding, vision, embeddings, summarization, classification, translation, speech, image_understanding, general_conversation, content_generation)
- Provider capability declarations (adapters)
- Telemetry (quality/latency/cost per capability)
- Task requirements (from Task Engine)

## Outputs

- **Capability Specification:** per-capability definition (id, name, description, inputs/outputs schema, quality tiers, providers supporting it, dependencies, version, owner, score, status)
- Registry query/composition results for Task Planner and Enterprise Brain

## Algorithms

### Capability definition

A capability has: id, name, description, input contract, output contract, quality tier support, modality support (text/image/audio), default constraints (token/cost/latency envelopes), dependency list, version, owner, status. Definitions align 1:1 with the typed taxonomy where possible; composed capabilities add new ids.

### Capability lifecycle

```
Proposed → Validated → Registered → Active → Deprecated → Retired → Archived
                ↘ Rejected
```

- **Proposed:** new capability request (module or provider capability discovery)
- **Validated:** POC/probe proves it (quality ≥ threshold on a probe set)
- **Registered:** available for routing; versioned
- **Active:** production; telemetry tracked
- **Deprecated/Retired:** replaced; consumers migrate (grace period)
- **Archived:** historical; used by Learning only

### Capability metadata

Standard: id, name, description, category, input/output contracts, modalities, quality tiers, constraints defaults, provider support matrix, dependency graph edges, owner, version, status, score, history.

### Capability registry

- **Source of truth** for routing decisions; superset of EI-001 build (Planned)
- Query API: `resolve(taskRequirements) → capability candidates`
- Syncs with provider capability declarations (adapters)

### Capability dependency graph

- A capability may depend on others (e.g., `content_generation` depends on `reasoning` + `summarization` + knowledge retrieval)
- Graph is a DAG; composition resolves transitively
- Dependencies affect cost/token budgets (aggregate envelopes)

### Capability ownership

Every capability has an owner (AI Platform Team or module team). Owners approve metadata changes, deprecation, and scoring weight adjustments. Ownership is recorded in the registry and reviewed quarterly.

### Capability scoring

`CapabilityScore(c)` per Mathematics §2 — weighted: availability (provider coverage × health), best-provider score, fallback strength, maturity. Used by the Brain to decide readiness and by routing to prefer healthy capabilities.

### Capability discovery

- **Provider-driven:** adapters declare capabilities (incl. new ones) → proposed → validated
- **Demand-driven:** modules request capabilities → if missing, route to proposed/probe
- **Benchmark-driven:** nightly benchmarks may surface capability gaps

### Capability composition

- **Sequential composition:** capability A then B (pipeline), budget = sum
- **Parallel composition:** A ∥ B (fan-out), budget = sum, sync point after
- **Conditional composition:** if/else branches on intermediate results
- Composition produces a **composed capability** with its own id/version, resolving to a sub-DAG of primitive capabilities

### Capability versioning

- Semantic versioning (major = contract break, minor = additive, patch = fixes)
- Providers declare the capability versions they support
- Consumers pin capability versions; migration warnings on deprecation
- Registry keeps full version history (rollback-capable)

## Scoring

| Score                        | Source         | Used for                          |
| ---------------------------- | -------------- | --------------------------------- |
| CapabilityScore              | Mathematics §2 | Readiness, routing preference     |
| ProviderScore per capability | Mathematics §1 | Provider choice within capability |

## Decision Flow

1. Task Engine submits task requirement (capability id or description)
2. Registry resolves: exact match → validate availability → compose if needed
3. If capability unknown → discovery (propose/probe) → fallback to nearest capability
4. Return Capability Specification + budget requirements to Task/Economy engines

## Failure Handling

- **Capability unavailable** (all providers down): degrade to nearest capable substitute with quality penalty, or block with escalation
- **Composition cycle:** reject composition, flag to owner
- **Version mismatch:** auto-resolve to compatible minor; major mismatch requires consumer migration or dual-run
- **Validation failure (new capability):** reject with evidence; record learning signal

## Learning

- Capability score calibration from outcome telemetry
- Composition cost/quality models learned from actuals
- Discovery effectiveness (how often proposed capabilities get adopted)

## Future Expansion

- EI-001 registry service (persistent, queryable)
- Capability marketplace integration (OSR-004)
- Automatic capability POC harness (benchmark-driven validation)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [CAPABILITY_REGISTRY.md](./CAPABILITY_REGISTRY.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md)
- `packages/ai/src/types/index.ts` (CapabilityType, CapabilityProfile)
