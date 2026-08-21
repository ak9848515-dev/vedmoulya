# SPRINT-035 — SIGNAL OPERATOR RUNBOOK

**Operating the LiveSignalAdapter — how to configure, run, monitor and decommission a world signal source.**
**Date:** 2026-08-15 · **No actual credentials are documented here — ever.**

---

## 1. What a signal source is

A `LiveSignalAdapter` implementing the frozen `WorldSignalSourcePort` (SPRINT-034).
It fetches a JSON list from an operator-configured endpoint, sanitizes the untrusted
content, requires provenance, and reports honest status:
**AVAILABLE** (source answered) / **UNAVAILABLE** (not configured) / **ERROR** (configured but failed).
It is **inert until configured** — unconfigured sources report UNAVAILABLE, never a fake SUCCESS.

**Safety rule: signal content is DATA only.** It becomes EVIDENCE — never AUTHORIZATION.
A world signal can never trigger execution, never approve, never spend.

---

## 2. Configuration (server-side env only)

| Variable                | Required         | Meaning                                                                                                             |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `WORLD_SIGNAL_BASE_URL` | for live signals | Operator JSON endpoint (e.g. `https://signals.example.com/v1/items`). Unset → UNAVAILABLE.                          |
| `WORLD_SIGNAL_TOKEN`    | optional         | Bearer token sent in the `authorization` header. **Server-side only — never in the browser bundle.**                |
| `WORLD_SIGNAL_KINDS`    | optional         | Comma-separated allowed kinds (closed vocabulary, e.g. `ai_model_releases,open_source_projects`). Empty = any kind. |

Set them in the server environment (`.env` on the host — **not** in any client config,
**not** committed). The gateway resolves sources once at startup
(`resolveWorldSignalSources()` in `WorldBridgePorts.ts`).

### 3. Expected response format

```json
[
  {
    "id": "sig-1",
    "title": "Model X released",
    "description": "A new open-weight model.",
    "kind": "ai_model_releases",
    "url": "https://example.com/news/x",
    "sourceId": "news-x",
    "publishedAt": "2026-08-15T09:00:00Z"
  }
]
```

- Top-level: a JSON **array** OR an object with an `items` array.
- `title` and/or `description` required (sanitized server-side: scripts stripped, markup removed, control chars dropped, lengths bounded).
- `id` optional (a stable id is derived from provenance when absent).
- **Provenance:** `url` and/or `sourceId` required — a signal with no source identity is REFUSED.
- `kind` is normalized against the closed vocabulary; unknown kinds map to the requested kind (never invented).
- Unknown/extra fields are ignored.

### 4. Timeout & payload limits

- **Timeout:** 10 s (AbortSignal) — a hung source is an ERROR, never an infinite wait.
- **Payload:** 256 KB max (`MAX_PAYLOAD_BYTES`) — enforced via `content-length` header AND body size; oversized = ERROR.
- **Per-kind:** at most 25 signals returned per fetch (`MAX_SIGNALS_PER_KIND`).
- **Title:** ≤ 200 chars. **Description:** ≤ 1000 chars. **URL/sourceId:** ≤ 500/200 chars.

### 5. Failure modes & honest status

| Condition                        | Status      | What happens                                                 |
| -------------------------------- | ----------- | ------------------------------------------------------------ |
| `WORLD_SIGNAL_BASE_URL` unset    | UNAVAILABLE | No sources created; `world.signals.list` reports UNAVAILABLE |
| Kind not in `WORLD_SIGNAL_KINDS` | UNAVAILABLE | Kind-specific: adapter answers UNAVAILABLE for that kind     |
| HTTP non-2xx                     | ERROR       | `Source answered <code>`; lastErrorAt recorded               |
| Timeout / network failure        | ERROR       | `Source failed: <message>`; lastErrorAt recorded             |
| Payload > 256 KB                 | ERROR       | Bounded — rejected before parsing                            |
| Non-JSON / wrong shape           | ERROR       | Rejected                                                     |
| Signal without provenance        | (refused)   | Signal dropped, source still AVAILABLE for the rest          |

### 6. Health monitoring (`world.signalHealth`)

Exposed per kind: `status` (AVAILABLE / UNAVAILABLE / ERROR), `lastSuccessAt`,
`lastErrorAt`, `lastError`, `configured`. A kind is AVAILABLE only after a real
successful observation — never pre-announced. Multiple sources: AVAILABLE if ANY
observed; otherwise ERROR preferred over UNAVAILABLE (most informative).

**Signal health is honest — do not trust "live" claims; check `lastSuccessAt`.**

### 7. Credential rotation & secret handling

- Rotate `WORLD_SIGNAL_TOKEN` by updating the server env and restarting the gateway.
- Credentials live server-side only. They never appear in: React components, browser
  bundles, client configuration, public env vars, or this documentation.
- Never log the token; the adapter only adds it to the outbound `authorization` header.
- Treat external content as untrusted input — sanitization is enforced before any use.

### 8. Source health checks

1. `GET <baseUrl>?kind=<kind>` with the token — expect the JSON shape above.
2. Call `world.signalHealth` and confirm `AVAILABLE` + `lastSuccessAt` populated.
3. Temporarily take the endpoint down and confirm `ERROR` + `lastErrorAt` — never a stale AVAILABLE.

### 9. Source disable procedure

1. Unset `WORLD_SIGNAL_BASE_URL` (or remove the kind from `WORLD_SIGNAL_KINDS`) in the server env.
2. Restart the gateway — sources resolve at startup.
3. Confirm `world.signalHealth` reports UNAVAILABLE and `world.signals.list` reports UNAVAILABLE.
4. No data loss: signals are **read-through** (never stored), so disabling a source leaves nothing to clean up.

### 10. Troubleshooting

| Symptom                                | Check                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Always UNAVAILABLE                     | Is `WORLD_SIGNAL_BASE_URL` set? Is the kind in `WORLD_SIGNAL_KINDS`?                          |
| ERROR "Source answered 401/403"        | Token missing/expired/rotated — update `WORLD_SIGNAL_TOKEN`.                                  |
| ERROR "Source failed: Failed to fetch" | Endpoint reachable? TLS? Firewall? Timeout?                                                   |
| ERROR "Payload exceeds"                | Source sending > 256 KB — bound it upstream or filter kinds.                                  |
| ERROR "non-JSON content"               | Source returning HTML/text — fix the endpoint or the `accept` header.                         |
| Signals missing (but AVAILABLE)        | Provenance absent (no `url`/`sourceId`) — signals refused; title/description empty — refused. |

### 11. Security considerations

- **Prompt injection / malicious instructions:** content is sanitized (scripts, markup,
  control chars stripped) and carries no authority fields — a signal can never
  authorize, never trigger execution.
- **Malicious URLs / poisoned metadata:** URLs and ids are length-bounded; treated as
  strings, never fetched by the adapter, never executed.
- **Oversized payloads / unexpected formats:** bounded + shape-validated.
- **Tenant confusion:** signals are owner-scoped at the service layer; sources are
  operator-global, observations are per-owner read-through.
- **Never put credentials in this runbook or any doc.** Document placeholders only.

## Production readiness status

- World signals: **OPERATOR_REQUIRED** (no endpoint configured → UNAVAILABLE; `production-config-check` lists it).
- Everything else (Brain, CostLedger, approval, execution bridge) remains authoritative and configured.
