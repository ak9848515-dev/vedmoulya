// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Doctor Report Tests (EPIC-019/11)
// `npm run doctor` rows: environment, Node, npm, TS runtime, database, redis,
// Docker, web build, AI runtime, default provider, provider adapters, port,
// configuration. These tests lock in the row-building contract without
// spawning processes.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PreflightEngine } from '../preflight.js';
import type { PreflightEnvironment } from '../preflight.js';
import { buildDoctorReport } from '../doctor.js';
import type { DoctorToolInputs } from '../doctor.js';

const JWT = 'x'.repeat(48);

function runPreflight(
  env: Record<string, string | undefined>,
  mode: 'development' | 'production',
  overrides: Partial<PreflightEnvironment> = {},
) {
  return new PreflightEngine({
    environment: {
      mode,
      env,
      evaluateConfig: () => ({ ok: true }),
      dockerAvailable: () => true,
      productionBuildExists: () => true,
      ...overrides,
    },
  }).run();
}

function tools(overrides: Partial<DoctorToolInputs> = {}): DoctorToolInputs {
  return {
    nodeVersion: process.version,
    npmVersion: '10.9.0',
    tsRuntimeError: null,
    port: { available: true },
    ...overrides,
  };
}

describe('doctor report — development without AI credentials', () => {
  const env = { AUTH_JWT_SECRET: JWT, NODE_ENV: 'development' };

  it('boots PASS with the deterministic mock and no paid keys', () => {
    const report = buildDoctorReport({
      mode: 'development',
      env,
      preflight: runPreflight(env, 'development'),
      tools: tools(),
    });
    const byId = new Map(report.map((r) => [r.id, r]));
    expect(byId.get('ai-runtime')?.status).toBe('PASS');
    expect(byId.get('provider-adapters')?.detail).toContain('Mock');
    expect(byId.get('port')?.status).toBe('PASS');
    expect(byId.get('node')?.status).toBe('PASS');
    // AI runtime is not required in development.
    expect(byId.get('ai-runtime')?.required).toBe(false);
  });
});

describe('doctor report — production fail-fast', () => {
  it('a blocked preflight cascades FAIL into the doctor configuration row', () => {
    const env = { AUTH_JWT_SECRET: JWT, NODE_ENV: 'production' };
    const preflight = new PreflightEngine({
      environment: {
        mode: 'production',
        env,
        evaluateConfig: () => ({ ok: false, error: 'MISSING production AI provider' }),
        dockerAvailable: () => false,
        productionBuildExists: () => false,
      },
    }).run();
    const report = buildDoctorReport({
      mode: 'production',
      env,
      preflight,
      tools: tools({ port: { available: true } }),
    });
    const byId = new Map(report.map((r) => [r.id, r]));
    expect(byId.get('ai-runtime')?.status).toBe('FAIL');
    expect(byId.get('configuration')?.status).toBe('FAIL');
  });

  it('occupied port is FAIL and names the port', () => {
    const env = {
      AUTH_JWT_SECRET: JWT,
      AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
      NODE_ENV: 'production',
    };
    const report = buildDoctorReport({
      mode: 'production',
      env,
      preflight: runPreflight(env, 'production', { productionBuildExists: () => true }),
      tools: tools({ port: { available: false, ownerPid: 4321 } }),
    });
    const port = report.find((r) => r.id === 'port');
    expect(port?.status).toBe('FAIL');
    expect(port?.detail).toContain('3000 is OCCUPIED');
  });

  it('toolchain failures surface as FAIL rows', () => {
    const env = { AUTH_JWT_SECRET: JWT, NODE_ENV: 'development' };
    const report = buildDoctorReport({
      mode: 'development',
      env,
      preflight: runPreflight(env, 'development'),
      tools: tools({ nodeVersion: null, npmVersion: null, tsRuntimeError: 'tsx unavailable' }),
    });
    const byId = new Map(report.map((r) => [r.id, r]));
    expect(byId.get('node')?.status).toBe('FAIL');
    expect(byId.get('npm')?.status).toBe('FAIL');
    expect(byId.get('typescript-runtime')?.status).toBe('FAIL');
  });
});

describe('doctor report — provider truth is visible', () => {
  it('catalog-only providers are explicitly unsupported in the adapters row', () => {
    const env = {
      AUTH_JWT_SECRET: JWT,
      AI_ANTHROPIC_API_KEY: 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890',
      NODE_ENV: 'development',
    };
    const report = buildDoctorReport({
      mode: 'development',
      env,
      preflight: runPreflight(env, 'development'),
      tools: tools(),
    });
    const row = report.find((r) => r.id === 'provider-adapters');
    expect(row?.detail).toContain('Anthropic (Claude): UNSUPPORTED_RUNTIME');
    expect(row?.detail).toContain('OpenAI: NOT_CONFIGURED');
    expect(row?.detail).toContain('DeepSeek: NOT_CONFIGURED');
  });

  it('never prints secret values anywhere in the report', () => {
    const env = {
      AUTH_JWT_SECRET: JWT,
      AI_OPENAI_API_KEY: 'sk-topsecret-abcdefghijklmnopqrstuvwxyz123456789',
      NODE_ENV: 'development',
    };
    const report = buildDoctorReport({
      mode: 'development',
      env,
      preflight: runPreflight(env, 'development'),
      tools: tools(),
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('sk-topsecret');
    expect(serialized).not.toContain(JWT);
  });
});
