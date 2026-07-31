// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Quick Action Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { QuickActionDTO } from '@vedmoulya/shared';
import type { LifeOSModule } from './LifeOSDTO.js';

export class LifeOSQuickActionService {
  aggregateQuickActions(
    sources: Array<{ module: LifeOSModule; actions: QuickActionDTO[] }>,
  ): QuickActionDTO[] {
    const all: QuickActionDTO[] = [];
    for (const source of sources) {
      for (const action of source.actions) {
        all.push({
          ...action,
          id: `lqa_${source.module}_${action.id}`,
          description: `[${source.module}] ${action.description}`,
        });
      }
    }
    return all.sort((a, b) => a.priority - b.priority).slice(0, 20);
  }

  getByCategory(actions: QuickActionDTO[], category: string): QuickActionDTO[] {
    return actions.filter((a) => a.category === category);
  }

  getTopActions(actions: QuickActionDTO[], count: number = 5): QuickActionDTO[] {
    return actions.slice(0, count);
  }
}
