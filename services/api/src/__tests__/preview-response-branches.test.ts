// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: PreviewService + ResponseMapper branch coverage
// EPIC-008 Phase 13 preview states; envelope defaults.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PreviewService } from '../services/PreviewService.js';
import {
  errorResponse,
  fromServiceResult,
  paginatedResponse,
  successResponse,
} from '../services/ResponseMapper.js';
import type { FactoryDetailDTO } from '@vedmoulya/app-factory';

function detail(files: Array<{ path: string; content: string }>): FactoryDetailDTO {
  return { name: 'App <b>1</b>', files } as unknown as FactoryDetailDTO;
}

describe('PreviewService (EPIC-008 Phase 13)', () => {
  it('returns the empty state when there is no UI entry point', async () => {
    const result = await new PreviewService().buildPreview(
      detail([{ path: 'src/logic.ts', content: 'export const x = 1;' }]),
    );
    expect(result.hasUi).toBe(false);
    expect(result.reason).toContain('src/ui/app.ts');
  });

  it('bundles the UI entry into a single self-contained HTML document', async () => {
    const result = await new PreviewService().buildPreview(
      detail([
        { path: 'src/ui/app.ts', content: 'export const render = () => {};' },
        { path: 'src/logic.ts', content: 'export const x = 1;' },
      ]),
    );
    expect(result.hasUi).toBe(true);
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain('Content-Security-Policy');
    expect(result.html).toContain('App &lt;b&gt;1&lt;/b&gt;'); // escaped title
  });

  it('surfaces a bundling failure as an actionable reason (never a stack)', async () => {
    const result = await new PreviewService().buildPreview(
      detail([
        {
          path: 'src/ui/app.ts',
          content: "import './missing-module.js'; export const render = () => {};",
        },
      ]),
    );
    expect(result.hasUi).toBe(true);
    expect(result.html).toBeUndefined();
    expect(result.reason).toContain('could not be bundled');
    expect(result.reason).not.toContain('at ');
  });
});

describe('ResponseMapper envelope defaults', () => {
  it('defaults duration to 0 on success and error', () => {
    const ok = successResponse('v');
    expect(ok.meta?.duration).toBe(0);
    const err = errorResponse(new Error('x'));
    expect(err.meta?.duration).toBe(0);
    expect(err.error?.code).toBe('INTERNAL_ERROR');
  });

  it('defaults message and duration when the service result omits them', () => {
    const result = fromServiceResult({ success: false });
    expect(result.error?.message).toBe('Service returned an error');
    expect(result.meta?.duration).toBe(0);
  });

  it('computes total pages with a fractional page count', () => {
    const page = paginatedResponse([1, 2], 5, 1, 2);
    expect(page.data?.totalPages).toBe(3);
    expect(page.success).toBe(true);
  });
});
