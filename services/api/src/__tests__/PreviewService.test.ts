// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Preview Service tests
// EPIC-008 — Phase 13. Deterministic: the generated projects are fixed
// templates and esbuild output for identical input is byte-identical, so the
// bundle assertions are stable. Covers the four UI states the client renders:
// success (hasUi + html), empty (no UI entry), error (un-bundlable entry),
// plus determinism.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { generateProject } from '@vedmoulya/app-factory';
import type { FactoryDetailDTO } from '@vedmoulya/app-factory';
import { PreviewService } from '../services/PreviewService.js';

type Archetype = 'abap-debugger' | 'restaurant-app' | 'ai-app-builder' | 'generic-web';

function detailFor(archetype: Archetype, name = 'demo'): FactoryDetailDTO {
  const files = generateProject(archetype, { applicationId: 'app-1', name });
  return { applicationId: 'app-1', owner: 'u1', name, files } as unknown as FactoryDetailDTO;
}

describe('PreviewService — EPIC-008 Phase 13', () => {
  const preview = new PreviewService();

  it('bundles the ABAP debugger UI into a sandboxed HTML preview', async () => {
    const result = await preview.buildPreview(detailFor('abap-debugger'));

    expect(result.hasUi).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.html).toBeDefined();

    // Self-contained sandbox shell.
    expect(result.html).toContain('Content-Security-Policy');
    expect(result.html).toContain("connect-src 'none'");
    expect(result.html).toContain("form-action 'none'");
    expect(result.html).toContain('id="root"');
    expect(result.html).toContain('VedApp.render');

    // The REAL generated logic is bundled in (never a fake placeholder).
    expect(result.html).toContain('Suspicious statements');
    expect(result.html).toContain('ABAP Debugger Assistant');
  });

  it('bundles every UI archetype', async () => {
    for (const archetype of ['restaurant-app', 'ai-app-builder', 'generic-web'] as const) {
      const result = await preview.buildPreview(detailFor(archetype));
      expect(result.hasUi, archetype).toBe(true);
      expect(result.html).toContain('VedApp.render');
    }
  });

  it('returns an empty state for applications without a UI entry', async () => {
    const detail = detailFor('abap-debugger');
    detail.files = detail.files.filter((f) => !f.path.startsWith('src/ui/'));
    const result = await preview.buildPreview(detail);

    expect(result.hasUi).toBe(false);
    expect(result.html).toBeUndefined();
    expect(result.reason).toContain('user-interface entry');
  });

  it('returns an actionable error state when the UI entry cannot be bundled', async () => {
    const detail = detailFor('abap-debugger');
    detail.files = detail.files.map((f) =>
      f.path === 'src/ui/app.ts' ? { ...f, content: 'export function render(' } : f,
    );
    const result = await preview.buildPreview(detail);

    expect(result.hasUi).toBe(true);
    expect(result.html).toBeUndefined();
    expect(result.reason).toContain('could not be bundled');
  });

  it('is deterministic — the same project always yields the same bundle', async () => {
    const detail = detailFor('abap-debugger');
    const first = await preview.buildPreview(detail);
    const second = await preview.buildPreview(detail);
    expect(first.html).toBe(second.html);
  });
});
