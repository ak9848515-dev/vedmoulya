// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — TS Runtime Probe (EPIC-019)
// Loaded by scripts/doctor.ts via `npx tsx <this file>`. Proves the repository
// TS runtime (tsx) can resolve and import the @vedmoulya/core TS module graph
// — the exact failure EPIC-018 fixed (plain `node -e require(...)` cannot
// resolve the TS sources). A script file (not `-e`) keeps Windows shell
// quoting deterministic.
//
// This probe deliberately does NOT evaluate configuration: importing
// @vedmoulya/core is inert (lazy config) and the environment/config check is
// reported separately by the doctor's Environment row. Exits 0 and prints
// "tsx-ok" when the module graph loads.
// ─────────────────────────────────────────────────────────────────────────────

import { PreflightEngine } from '@vedmoulya/core';

// Reference the import so the module graph is actually resolved (no
// tree-shaking): construct the engine without running it.
void new PreflightEngine({
  environment: {
    mode: 'development',
    env: {},
    evaluateConfig: () => ({ ok: true }),
    dockerAvailable: () => false,
    productionBuildExists: () => false,
  },
});
console.log('tsx-ok');
