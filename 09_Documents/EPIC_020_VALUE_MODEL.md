# EPIC-020 — Value & Priority Model

**Value Model · 2026-08-12**

## 1. The transparent hierarchy

The `OutcomePriorityEngine` ranks candidate actions using a fixed, transparent hierarchy with **constant weights** (sum = 1) — the same order the mission specifies:

| Rank | Factor          | Weight | Signal source                                                 |
| ---- | --------------- | ------ | ------------------------------------------------------------- |
| 1    | USER OUTCOME    | 0.14   | category fit (EARNING/PROBLEM/CAREER/…)                       |
| 2    | URGENCY         | 0.13   | CRITICAL 1.0 · HIGH 0.8 · MEDIUM 0.55 · LOW 0.3 · UNKNOWN 0.2 |
| 3    | IMPACT          | 0.12   | problem severity / business weight                            |
| 4    | MONEY / SAVINGS | 0.12   | evidence-backed only                                          |
| 5    | TIME SAVINGS    | 0.11   | evidence-backed only                                          |
| 6    | FEASIBILITY     | 0.09   | 0..1                                                          |
| 7    | EVIDENCE        | 0.09   | quantity/quality of backing                                   |
| 8    | QUALITY         | 0.10   | **the dominant single factor**                                |
| 9    | USER FIT        | 0.06   | goals/preferences                                             |
| 10   | COST            | 0.04   | free 1.0 … paid 0.25 — deliberately small                     |

**Quality + evidence + impact + money + time (0.10 + 0.09 + 0.12 + 0.12 + 0.11 = 0.54) always dominate cost + free/local (0.04).** A free candidate can never leapfrog a materially better one.

## 2. Invariants

1. **Quality never outranked by price** — verified by benchmark scenario 4: a paid candidate with strong quality/evidence beats a free weak candidate; scenario 3 proves the reverse (free preferred when quality is equivalent).
2. **UNKNOWN contributes zero** — an absent money/time/evidence signal contributes 0, never an invented number (scenario check: UNKNOWN `moneyValue` → money factor signal = 0).
3. **Transparent breakdown** — every ranked action exposes `factorBreakdown` (factor × weight × signal) + a plain-English `reason`.

## 3. Money opportunity model (mission §3)

Every money-adjacent opportunity carries:

- `requiredCapabilities` / `requiredProviders` — only when identifiable
- `estimatedEffort` / `cost` — only when evidence exists
- `risk` (LOW / MEDIUM / HIGH / UNKNOWN) — derived from the existing security classification
- `approvalRequirement` — review/approval before adoption
- `recommendedNextAction` — the exact next step
- `uncertainty` — always present, never a promise
- `estimatedValue` — only when evidence supports it

**No fake income claims**: `detectFromEvents`/`detectFromOutcome` never invent a dollar figure; an automation opportunity's value stays `UNKNOWN` unless measured.

## 4. Satisfaction loop (mission §10)

Outcome evaluation now records the 3-value feedback explicitly:

- **YES** → success evidence, explicit preference fact
- **PARTIALLY** → partial success, explicit fact
- **NO** → failed, explicit fact

Mapped to the outcome statuses SUCCESS / PARTIAL_SUCCESS / FAILED / USER_REJECTED / BLOCKED / UNKNOWN and stored in `BrainOutcomeMemory.satisfaction` — the learning feed evolves from binary accept/reject to a 3-value signal. Only concise decision explanations and provenance are exposed — never hidden chain-of-thought.
