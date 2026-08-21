import { describe, expect, it } from 'vitest';
import { ControlGate } from '../domain/ControlGate.js';
import { EmergencyStop, type EmergencyStopStore } from '../domain/EmergencyStop.js';
import type { AutonomySettings, EmergencyStopState } from '../types/control-types.js';

function stopStore(engaged: boolean): EmergencyStopStore {
  let state: EmergencyStopState | undefined = engaged
    ? {
        ownerId: 'u1',
        engaged: true,
        engagedAt: '2026-08-14T09:00:00Z',
        engagedBy: 'alice',
        reason: 'stop',
        history: [],
      }
    : undefined;
  return {
    get: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function settings(overrides: Partial<AutonomySettings> = {}): AutonomySettings {
  return {
    ownerId: 'u1',
    autonomyLevel: 4,
    allowedCategories: [],
    prohibitedCategories: [],
    maxDailyCostUsd: 10,
    maxTaskCostUsd: 1,
    allowedProviders: [],
    prohibitedProviders: [],
    privateOnly: false,
    userConfirmed: true,
    notificationPreference: 'briefing-only',
    quietHours: {},
    automationPermissions: [],
    updatedAt: '2026-08-14T08:00:00Z',
    updatedBy: 'u1',
    ...overrides,
  };
}

function makeGate(engaged = false) {
  const gate = new ControlGate();
  const emergencyStop = new EmergencyStop(stopStore(engaged));
  return { gate, emergencyStop };
}

describe('ControlGate (SPRINT-031) — structural guarantees', () => {
  it('EMERGENCY_STOP blocks EVERY action when engaged (fail-closed)', () => {
    const { gate, emergencyStop } = makeGate(true);
    const decision = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the document',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: true,
    });
    expect(decision.verdict).toBe('EMERGENCY_STOP');
    expect(decision.allowed).toBe(false);
  });

  it('NO execution without confirmed settings — missing/unconfirmed = blocked', () => {
    const { gate, emergencyStop } = makeGate();
    const missing = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the document',
      category: 'TASK',
      settings: undefined,
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(missing.verdict).toBe('BLOCKED_BY_POLICY');

    const unconfirmed = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the document',
      category: 'TASK',
      settings: settings({ userConfirmed: false }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(unconfirmed.verdict).toBe('BLOCKED_BY_POLICY');
  });

  it('NO class C direct execution — a sensitive action returns WAITING_FOR_APPROVAL even at level 4', () => {
    const { gate, emergencyStop } = makeGate();
    const decision = gate.gate({
      ownerId: 'u1',
      action: 'Publish the report to the website',
      category: 'OPPORTUNITY',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(decision.verdict).toBe('WAITING_FOR_APPROVAL');
    expect(decision.actionClass).toBe('C');
    expect(decision.approvalRequired).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it('NO class D autonomous execution at ANY level', () => {
    const { gate, emergencyStop } = makeGate();
    const decision = gate.gate({
      ownerId: 'u1',
      action: 'bypass-security to read the vault',
      category: 'SYSTEM_IMPROVEMENT',
      settings: settings({ autonomyLevel: 5 }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(decision.verdict).toBe('BLOCKED_BY_POLICY');
    expect(decision.actionClass).toBe('D');
    if (decision.reasons[0]) expect(decision.reasons[0]).toMatch(/never automate/i);
  });

  it('NO budget bypass — exceeding a daily or task cap returns BLOCKED_BY_BUDGET', () => {
    const { gate, emergencyStop } = makeGate();
    const overTask = gate.gate({
      ownerId: 'u1',
      action: 'Analyze the dataset',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
      cost: { dailyUsd: 0, taskUsd: 0 },
      additionalUsd: 2, // task cap is 1
    });
    expect(overTask.verdict).toBe('BLOCKED_BY_BUDGET');

    const overDaily = gate.gate({
      ownerId: 'u1',
      action: 'Analyze the dataset',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
      cost: { dailyUsd: 9.5, taskUsd: 0 },
      additionalUsd: 0.1, // 9.5 + 0.1 = 9.6 < 10 → allowed
    });
    expect(overDaily.verdict).toBe('ALLOWED');

    const capped = gate.gate({
      ownerId: 'u1',
      action: 'Analyze the dataset',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
      cost: { dailyUsd: 9.95, taskUsd: 0 },
      additionalUsd: 0.1, // 10.05 > 10 → blocked
    });
    expect(capped.verdict).toBe('BLOCKED_BY_BUDGET');
  });

  it('prohibited category and provider restrictions are hard policy', () => {
    const { gate, emergencyStop } = makeGate();
    const cat = gate.gate({
      ownerId: 'u1',
      action: 'Start a dropshipping store',
      category: 'BUSINESS_OPPORTUNITY',
      settings: settings({ prohibitedCategories: ['BUSINESS_OPPORTUNITY'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(cat.verdict).toBe('BLOCKED_BY_POLICY');

    const prov = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the document',
      category: 'TASK',
      providerId: 'openai',
      settings: settings({ prohibitedProviders: ['openai'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(prov.verdict).toBe('BLOCKED_BY_POLICY');
  });

  it('explicit allowed-categories allowlist blocks anything outside it', () => {
    const { gate, emergencyStop } = makeGate();
    const allowed = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the weekly report',
      category: 'TASK',
      settings: settings({ allowedCategories: ['TASK'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(allowed.verdict).toBe('ALLOWED');

    const blocked = gate.gate({
      ownerId: 'u1',
      action: 'Analyze the dataset',
      category: 'RESEARCH',
      settings: settings({ allowedCategories: ['TASK'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(blocked.verdict).toBe('BLOCKED_BY_POLICY');
    if (blocked.reasons[0]) expect(blocked.reasons[0]).toMatch(/allowed categories/);
  });

  it('explicit allowed-providers allowlist blocks any other provider', () => {
    const { gate, emergencyStop } = makeGate();
    const allowed = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the weekly report',
      category: 'TASK',
      providerId: 'anthropic',
      settings: settings({ allowedProviders: ['anthropic'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(allowed.verdict).toBe('ALLOWED');

    const blocked = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the weekly report',
      category: 'TASK',
      providerId: 'openai',
      settings: settings({ allowedProviders: ['anthropic'] }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(blocked.verdict).toBe('BLOCKED_BY_POLICY');
    if (blocked.reasons[0]) expect(blocked.reasons[0]).toMatch(/allowed providers/);
  });

  it('privateOnly forbids remote provider use', () => {
    const { gate, emergencyStop } = makeGate();
    const decision = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the document',
      category: 'TASK',
      providerId: 'openai',
      settings: settings({ privateOnly: true }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(decision.verdict).toBe('BLOCKED_BY_POLICY');
    if (decision.reasons[0]) expect(decision.reasons[0]).toMatch(/privateOnly/);
  });

  it('class A at a sufficient level is ALLOWED (advisory — execution authority still governs)', () => {
    const { gate, emergencyStop } = makeGate();
    const decision = gate.gate({
      ownerId: 'u1',
      action: 'Summarize the weekly report',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(decision.verdict).toBe('ALLOWED');
    expect(decision.actionClass).toBe('A');
    expect(decision.allowed).toBe(true);
  });

  it('class B without an explicit user-authorization record is blocked even at level 5', () => {
    const { gate, emergencyStop } = makeGate();
    const without = gate.gate({
      ownerId: 'u1',
      action: 'Prepare the monthly sales report',
      category: 'AUTOMATION',
      settings: settings({ autonomyLevel: 5 }),
      emergencyStop,
      emergencyStopEngaged: false,
    });
    expect(without.verdict).toBe('BLOCKED_BY_POLICY');
    expect(without.actionClass).toBe('B');

    const withAuth = gate.gate({
      ownerId: 'u1',
      action: 'Prepare the monthly sales report',
      category: 'AUTOMATION',
      settings: settings({ autonomyLevel: 4, automationPermissions: ['wf-sales-report'] }),
      emergencyStop,
      emergencyStopEngaged: false,
      userAuthorization: {
        id: 'auth-1',
        grantedAt: '2026-08-14T08:00:00Z',
        scope: 'wf-sales-report',
      },
    });
    expect(withAuth.verdict).toBe('ALLOWED');
    expect(withAuth.actionClass).toBe('B');
  });

  it('is deterministic — identical inputs produce identical verdicts', () => {
    const { gate, emergencyStop } = makeGate();
    const input = {
      ownerId: 'u1',
      action: 'Summarize the weekly report',
      category: 'TASK',
      settings: settings(),
      emergencyStop,
      emergencyStopEngaged: false,
    };
    expect(gate.gate(input).verdict).toBe(gate.gate(input).verdict);
  });
});
