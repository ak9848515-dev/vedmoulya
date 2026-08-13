// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-010: Experience Application Service
// Tests the experience.* service contract (evaluate → findings →
// refine) and the DTO boundary.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExperienceApplicationService } from '../ExperienceApplicationService.js';

const GOOD_FILES = [
  {
    path: 'src/ui/app.tsx',
    content:
      'export const App = () => (<main role="main" aria-live="polite"><h1>Menu</h1><div className="grid sm:grid-cols-2 lg:grid-cols-3">items</div><div className="loading">Loading…</div><div className="empty">Empty</div><div className="error">Error</div></main>);',
  },
  {
    path: 'src/ui/styles.css',
    content: '@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }',
  },
];

describe('ExperienceApplicationService', () => {
  it('evaluate returns the full quality bundle DTO', () => {
    const service = new ExperienceApplicationService();
    const dto = service.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: GOOD_FILES,
    });
    expect(dto.applicationId).toBe('app-1');
    expect(dto.designSystem.tokens.length).toBeGreaterThan(0);
    expect(dto.blueprint.screens.length).toBeGreaterThan(0);
    expect(dto.designDecisions.length).toBeGreaterThan(0);
    expect(dto.critic.score).toBeGreaterThanOrEqual(0);
    expect(dto.quality.dimensions).toHaveLength(10);
    expect(dto.traceability.length).toBe(dto.designDecisions.length);
  });

  it('findings returns evidence-classified findings with summaries', () => {
    const service = new ExperienceApplicationService();
    const { findings } = service.findings({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: GOOD_FILES,
    });
    expect(Array.isArray(findings)).toBe(true);
    for (const f of findings) {
      expect(f.summary.length).toBeGreaterThan(0);
      expect(['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND']).toContain(f.evidenceClass);
    }
  });

  it('refine returns a targeted refinement plan for an existing finding', () => {
    const service = new ExperienceApplicationService();
    const { findings } = service.findings({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: GOOD_FILES,
    });
    const first = findings[0];
    expect(first).toBeDefined();
    const dto = service.refine({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      findingId: first!.id,
      files: GOOD_FILES,
    });
    expect(dto.plan.findingId).toBe(first!.id);
    expect(dto.plan.impact.targeted).toBe(true);
    expect(dto.plan.requiresApproval).toBeDefined();
  });

  it('refine rejects an unknown finding id', () => {
    const service = new ExperienceApplicationService();
    expect(() =>
      service.refine({
        applicationId: 'app-1',
        archetype: 'restaurant-app',
        findingId: 'VC-999',
        files: GOOD_FILES,
      }),
    ).toThrow();
  });

  it('passes security findings and validation evidence into the evaluation', () => {
    const service = new ExperienceApplicationService();
    const dto = service.evaluate({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      files: GOOD_FILES,
      securityFindings: [{ severity: 'HIGH', description: 'open redirect in auth callback' }],
      validationEvidence: [{ gate: 'build', passed: false, detail: 'build failed' }],
    });
    expect(dto.quality.blockingDimensions).toContain('SECURITY');
    expect(dto.quality.blockingDimensions).toContain('FUNCTIONAL');
    expect(dto.quality.verdict).toBe('NOT_READY');
  });
});
