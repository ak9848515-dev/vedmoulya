// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Doctor Report (EPIC-019/11)
//
// `npm run doctor` is a single deterministic startup diagnostic command. The
// REPORT BUILDER lives here (pure + injectable, like PreflightEngine) so it is
// unit-testable without spawning processes; the CLI binding
// (scripts/doctor.ts) supplies the real machine probes.
//
// Every row answers WHAT / (status) and WHY/ACTION in `detail`. The report
// NEVER prints secret values — only key NAMES.
// ─────────────────────────────────────────────────────────────────────────────

import type { PreflightCheck, PreflightMode, PreflightReport } from './preflight.js';
import {
  PROVIDER_RUNTIME_DESCRIPTORS,
  readProviderRuntimeState,
  runtimeExecutionReady,
  validateDefaultProvider,
} from './provider-runtime.js';

export type DoctorStatus =
  | 'PASS'
  | 'FAIL'
  | 'NOT_REQUIRED' // optional dependency intentionally absent in this mode
  | 'WARN' // soft gap (mode continues)
  | 'INFO'; // informational row (never blocks)

export interface DoctorRow {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
  /** Fail hard whenever this row reports FAIL (used by doctor exit code). */
  required: boolean;
}

export interface DoctorToolInputs {
  /** process.version of the running Node, or null when unavailable. */
  nodeVersion: string | null;
  /** Output of `npm --version`, or null when npm cannot be started. */
  npmVersion: string | null;
  /** Error message when the repository TS runtime (tsx) cannot run. */
  tsRuntimeError: string | null;
  /** Port probe (web port availability + optional owner). */
  port: { available: boolean; ownerPid?: number; ownerCommand?: string } | null;
}

function preflightRow(check: PreflightCheck): DoctorRow {
  const ok =
    check.status === 'READY' || check.status === 'DEGRADED' || check.status === 'NOT_CONFIGURED';
  const status: DoctorStatus = ok
    ? check.status === 'READY'
      ? 'PASS'
      : check.required
        ? 'WARN'
        : check.status === 'NOT_CONFIGURED'
          ? 'NOT_REQUIRED'
          : 'WARN'
    : 'FAIL';
  return {
    id: `preflight:${check.id}`,
    label: check.label,
    status,
    detail: check.required
      ? `${check.status} — ${check.detail}${check.howToFix ? ` Action: ${check.howToFix}` : ''}`
      : `${check.status} — ${check.detail}`,
    required: check.required,
  };
}
function pushFromCheck(rows: DoctorRow[], byId: Map<string, PreflightCheck>, id: string): void {
  const check = byId.get(id);
  if (check) rows.push(preflightRow(check));
}

function nodeRow(nodeVersion: string | null): DoctorRow {
  if (!nodeVersion) {
    return {
      id: 'node',
      label: 'Node',
      status: 'FAIL',
      detail: 'Node runtime unavailable.',
      required: true,
    };
  }
  const major = parseInt(nodeVersion.replace(/^v/, '').split('.')[0] ?? '0', 10);
  const ok = major >= 20;
  return {
    id: 'node',
    label: 'Node',
    status: ok ? 'PASS' : 'FAIL',
    detail: ok
      ? `Node ${nodeVersion} (>= 20 required).`
      : `Node ${nodeVersion} is below the required >= 20. Upgrade Node.`,
    required: true,
  };
}

function npmRow(npmVersion: string | null): DoctorRow {
  if (!npmVersion) {
    return {
      id: 'npm',
      label: 'npm',
      status: 'FAIL',
      detail: 'npm could not be started.',
      required: true,
    };
  }
  const major = parseInt(npmVersion.split('.')[0] ?? '0', 10);
  const ok = major >= 10;
  return {
    id: 'npm',
    label: 'npm',
    status: ok ? 'PASS' : 'FAIL',
    detail: ok
      ? `npm ${npmVersion} (>= 10 required).`
      : `npm ${npmVersion} is below the required >= 10.`,
    required: true,
  };
}

function tsRuntimeRow(tsRuntimeError: string | null): DoctorRow {
  if (tsRuntimeError) {
    return {
      id: 'typescript-runtime',
      label: 'TypeScript runtime',
      status: 'FAIL',
      detail: tsRuntimeError,
      required: true,
    };
  }
  return {
    id: 'typescript-runtime',
    label: 'TypeScript runtime',
    status: 'PASS',
    detail: 'tsx is available — @vedmoulya/core TS sources load through the repository TS runtime.',
    required: true,
  };
}
/**
 * Build the doctor report. `preflight` is produced by PreflightEngine with the
 * real environment probes; `tools` carries the process probes the CLI gathered.
 */
export function buildDoctorReport(options: {
  mode: PreflightMode;
  env: Record<string, string | undefined>;
  preflight: PreflightReport;
  tools: DoctorToolInputs;
  webPort?: number;
}): DoctorRow[] {
  const rows: DoctorRow[] = [];
  const { mode, env, preflight, tools, webPort = 3000 } = options;
  const strict = mode === 'production' || mode === 'staging';

  // ── Toolchain ─────────────────────────────────────────────────────────────
  rows.push(nodeRow(tools.nodeVersion));
  rows.push(npmRow(tools.npmVersion));
  rows.push(tsRuntimeRow(tools.tsRuntimeError));

  // ── Preflight-derived rows ────────────────────────────────────────────────
  const byId = new Map(preflight.checks.map((c) => [c.id, c]));
  pushFromCheck(rows, byId, 'environment');
  pushFromCheck(rows, byId, 'database');
  pushFromCheck(rows, byId, 'redis');
  pushFromCheck(rows, byId, 'docker');
  pushFromCheck(rows, byId, 'production-build');

  // ── AI / provider truth ───────────────────────────────────────────────────
  const aiEnabled = env.FF_AI_ASSISTANT_ENABLED !== 'false';
  const runtime = runtimeExecutionReady(env, mode, { aiEnabled });
  const defaultCheck = validateDefaultProvider(env, mode);
  const states = readProviderRuntimeState(env, mode, { aiEnabled });
  rows.push({
    id: 'ai-runtime',
    label: 'AI runtime',
    status: runtime.ok ? (runtime.providers.includes('mock') && strict ? 'WARN' : 'PASS') : 'FAIL',
    detail: runtime.ok ? runtime.reason : `FAIL — ${runtime.reason}`,
    required: strict,
  });
  rows.push({
    id: 'default-provider',
    label: 'Default provider',
    status: defaultCheck.ok ? 'PASS' : strict ? 'FAIL' : 'WARN',
    detail: defaultCheck.ok
      ? `AI_DEFAULT_PROVIDER=${defaultCheck.family} — runtime-supported.`
      : defaultCheck.reason,
    required: strict,
  });
  rows.push({
    id: 'provider-adapters',
    label: 'Provider adapters',
    status: 'INFO',
    detail: states
      .map((s) => `${s.name}: ${s.status}${s.registered ? ' (registered)' : ''}`)
      .join(' · '),
    required: false,
  });
  rows.push({
    id: 'provider-catalog',
    label: 'Provider taxonomy/catalog',
    status: 'INFO',
    detail: PROVIDER_RUNTIME_DESCRIPTORS.map((d) => d.name).join(', '),
    required: false,
  });

  // ── Port ──────────────────────────────────────────────────────────────────
  if (tools.port) {
    rows.push({
      id: 'port',
      label: `Port ${webPort}`,
      status: tools.port.available ? 'PASS' : 'FAIL',
      detail: tools.port.available
        ? `${webPort} is AVAILABLE.`
        : `Port ${webPort} is OCCUPIED${tools.port.ownerPid !== undefined ? ` by PID ${tools.port.ownerPid}` : ''}. Stop the process or use another port.`,
      required: true,
    });
  }

  // ── Configuration (fail-fast config evaluation) ────────────────────────────
  const configCheck = byId.get('environment');
  rows.push({
    id: 'configuration',
    label: 'Configuration',
    status: preflight.ready ? (configCheck?.status === 'READY' ? 'PASS' : 'WARN') : 'FAIL',
    detail: preflight.ready
      ? 'Fail-fast configuration evaluation passed.'
      : 'Fail-fast configuration evaluation blocked the mode (see rows above).',
    required: true,
  });

  return rows;
}
