# SPRINT-034 — WORLD SIGNALS

**Live WorldSignalSourcePort adapters — provenance, honesty, safety**

---

## 1. What was built

`packages/world-model/src/infrastructure/LiveSignalAdapter.ts` — an
**operator-configurable** implementation of the frozen `WorldSignalSourcePort`
interface. It is the ONLY live adapter; no data is fabricated and unavailable
sources remain UNAVAILABLE.

## 2. Configuration (server-side only)

```env
# Operator configuration (server-side) — never in the browser.
WORLD_SIGNAL_BASE_URL=https://your-signal-source.example/v1
WORLD_SIGNAL_TOKEN=            # optional; sent only as a Bearer header server-side
WORLD_SIGNAL_KINDS=            # optional subset of the closed vocabulary
```

- No credentials are embedded in code; the token never crosses to the browser
  (the adapter lives in the gateway process and is not exposed to the client).
- Not configured → `listSignals` returns **UNAVAILABLE** (never AVAILABLE).
- Configured but unreachable/broken → **ERROR**.

## 3. Provenance (required, not optional)

Every signal is REFUSED unless it carries provenance: `sourceId` and/or `url`,
plus `retrievedAt` (server clock). `publishedAt` is preserved when the source
provides it. Kinds are normalized against the closed vocabulary — an unknown
kind maps to the requested kind (never invented).

## 4. Untrusted-content safety

External content is treated as untrusted, never as instructions:

- `sanitizeExternalText` strips script blocks, HTML markup and control
  characters (`\p{Cc}`), collapses whitespace, and bounds length.
- Payloads are size-bounded (header + body checks against
  `MAX_PAYLOAD_BYTES`); oversized payloads → ERROR.
- Fetch uses a 10-second `AbortController` timeout.
- Non-JSON or unexpected shapes → ERROR (never partial SUCCESS).
- A signal can become **EVIDENCE** but can never become **AUTHORIZATION** —
  nothing in the adapter (or the world model) can trigger execution from a
  signal (structural + tested).

## 5. States

| State       | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| AVAILABLE   | Source answered; signals carry provenance             |
| UNAVAILABLE | Not configured / kind not enabled / source down       |
| ERROR       | Source error, timeout, oversized or malformed payload |

UNAVAILABLE is never reported as SUCCESS (tested).

## 6. Status

- Adapter: IMPLEMENTED + TESTED (configuration, provenance refusal, sanitizer,
  injection safety, failure states).
- Live data: **OPERATOR-REQUIRED** — until an operator points
  `WORLD_SIGNAL_BASE_URL` at a real source, every signal reports UNAVAILABLE.
- Real-time market intelligence: NOT CLAIMED.
