// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: boolean env-flag parsing (shared by the runtime
// cadence drivers).
//
// SPRINT-043E D2 — the cadence drivers originally read `FLAG !== '0'`, so only
// the literal `0` disabled a flag and `false` silently left it ENABLED. All
// boolean cadence flags must use this parser: any explicit false-y spelling
// (`0`, `false`, `no`, `off` — case-insensitive, trimmed, or empty) disables;
// unset falls back to the default (normally true). The explicit `enabled`
// options in the drivers are NOT routed through this parser — callers pass
// real booleans and `??` keeps their semantics.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a boolean env flag for the cadence drivers. Only explicit false-y
 *  spellings disable: '0', 'false', 'no', 'off' (case-insensitive, trimmed)
 *  and an empty value. Unset falls back to the default (normally true). */
export function envFlagEnabled(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return (
    normalized !== '' &&
    normalized !== '0' &&
    normalized !== 'false' &&
    normalized !== 'no' &&
    normalized !== 'off'
  );
}
