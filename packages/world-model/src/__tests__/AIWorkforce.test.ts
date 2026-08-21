// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AIWorkforce tests (SPRINT-032)
// Provider-neutral AI workforce abstraction:
//   • ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT (roles name responsibilities, never
//     provider ids)
//   • provider substitution never changes the role/workflow
//   • worker authority NEVER exceeds its role (no escalation)
//   • a worker can NEVER create another worker with greater authority
//   • workers are ADVISORY — never executed/spent/deployed
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIWorkforce, canEscalate } from '../domain/AIWorkforce.js';

const workforce = new AIWorkforce();

function contentResearcher(): ReturnType<AIWorkforce['registerRole']> {
  return workforce.registerRole({
    ownerId: 'u1',
    name: 'CONTENT_RESEARCHER',
    responsibilities: ['Research market evidence', 'Summarize sources'],
    capabilities: ['RESEARCH', 'TEXT_GENERATION'],
    providerStrategies: ['LOW_COST', 'FREE', 'LOCAL'],
    privacyRequirement: 'STANDARD',
    authorityClass: 'A',
  });
}

describe('AIWorkforce', () => {
  it('a role names responsibilities + capabilities — NEVER a provider id', () => {
    const result = contentResearcher();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.providerId).toBeUndefined(); // roles have no provider
    expect(result.data.name).toBe('CONTENT_RESEARCHER');
    expect(result.data.capabilities).toContain('RESEARCH');
  });

  it('provider substitution is free: the same role can bind any provider', () => {
    const role = contentResearcher();
    if (!role.success) return;
    const gemini = workforce.suggestWorker({
      ownerId: 'u1',
      role: role.data,
      selection: {
        strategy: 'BALANCED',
        selected: { providerId: 'google', modelId: 'gemini-2.0' },
        reasons: ['capability matched'],
      },
    });
    const openai = workforce.suggestWorker({
      ownerId: 'u1',
      role: role.data,
      selection: {
        strategy: 'BALANCED',
        selected: { providerId: 'openai', modelId: 'gpt-4o-mini' },
        reasons: ['capability matched'],
      },
    });
    const local = workforce.suggestWorker({
      ownerId: 'u1',
      role: role.data,
      selection: {
        strategy: 'PRIVATE',
        selected: { providerId: 'ollama', modelId: 'llama3' },
        reasons: ['private task'],
      },
    });
    expect(gemini.success && gemini.data.providerId).toBe('google');
    expect(openai.success && openai.data.providerId).toBe('openai');
    expect(local.success && local.data.providerId).toBe('ollama');
    // Same roleName across all bindings — the business workflow never changes.
    if (gemini.success && openai.success) {
      expect(gemini.data.roleName).toBe(openai.data.roleName);
    }
  });

  it('workers are ADVISORY and never exceed the role authority', () => {
    const role = contentResearcher(); // class A
    if (!role.success) return;
    const worker = workforce.suggestWorker({
      ownerId: 'u1',
      role: role.data,
      selection: { strategy: 'QUALITY', selected: { providerId: 'openai' }, reasons: [] },
    });
    expect(worker.success).toBe(true);
    if (worker.success) {
      expect(worker.data.advisory).toBe(true);
      expect(worker.data.authorityClass).toBe('A'); // never exceeds role
    }
  });

  it('canEscalate is deterministic — authority never jumps UP', () => {
    expect(canEscalate('B', 'A')).toBe(true); // down is fine
    expect(canEscalate('B', 'B')).toBe(true); // same is fine
    expect(canEscalate('B', 'C')).toBe(false); // up is refused
    expect(canEscalate('A', 'D')).toBe(false);
  });

  it('a worker can NEVER create another worker with greater authority (structural)', () => {
    const role = contentResearcher(); // class A
    if (!role.success) return;
    // Creating a class B or C worker from a class A role is refused.
    expect(workforce.canDelegate(role.data, 'B')).toBe(false);
    expect(workforce.canDelegate(role.data, 'C')).toBe(false);
    expect(workforce.canDelegate(role.data, 'D')).toBe(false);
    // Delegating at-or-below is fine.
    expect(workforce.canDelegate(role.data, 'A')).toBe(true);

    const admin = workforce.registerRole({
      ownerId: 'u1',
      name: 'OPERATIONS',
      responsibilities: ['Oversee delivery'],
      capabilities: ['REASONING'],
      authorityClass: 'C',
    });
    if (!admin.success) return;
    expect(workforce.canDelegate(admin.data, 'C')).toBe(true);
    expect(workforce.canDelegate(admin.data, 'D')).toBe(false); // D never
  });

  it('a role needs responsibilities and capabilities', () => {
    const empty = workforce.registerRole({
      ownerId: 'u1',
      name: 'GHOST',
      responsibilities: [],
      capabilities: [],
    });
    expect(empty.success).toBe(false);
  });

  it('refuses empty names, over-long names and missing capabilities', () => {
    expect(
      workforce.registerRole({
        ownerId: 'u1',
        name: '',
        responsibilities: ['x'],
        capabilities: ['R'],
      }).success,
    ).toBe(false);
    expect(
      workforce.registerRole({
        ownerId: 'u1',
        name: 'x'.repeat(81),
        responsibilities: ['x'],
        capabilities: ['R'],
      }).success,
    ).toBe(false);
    // responsibilities present but capabilities missing → refused.
    expect(
      workforce.registerRole({
        ownerId: 'u1',
        name: 'ROLE',
        responsibilities: ['x'],
        capabilities: [],
      }).success,
    ).toBe(false);
  });
});
