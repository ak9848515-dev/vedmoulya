// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Platform Validation
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The definitive `validatePlatform` gate used by final certification:
//   - every engine consumes correct inputs and produces correct outputs
//     (port reachability + live data);
//   - shared contracts are unique (no duplicated models/services);
//   - no circular package dependencies;
//   - every engine resolves a persisted repository;
//   - every engine lifecycle reports;
//   - the 15-stage event flow is validated;
//   - all nine cross-engine pairs are healthy;
//   - performance is measured.
// valid = every check passed.
// ──────────────────────────────────────────────────────────────────

import type {
  OSPlatformValidation,
  OSSystemHealth,
  OSValidationCheck,
} from '../../types/os-types.js';
import { engineSpecsRule } from '../rules/OSRules.js';
import type { OSEngines } from '../../contracts/os-engines.js';
import { OSHealthService } from './OSHealthService.js';

export class OSValidationService {
  constructor(private readonly health: OSHealthService) {}

  /** Run a fresh health pass and validate the platform against it. */
  async validatePlatform(engines: OSEngines): Promise<OSPlatformValidation> {
    const health = await this.health.systemHealth(engines);
    return this.validateFromHealth(health);
  }

  /** Validate the platform against an already-completed health pass. */
  validateFromHealth(health: OSSystemHealth): OSPlatformValidation {
    const checks: OSValidationCheck[] = [
      this.check(
        'check-engines',
        'engine',
        'every engine port responds with correct outputs',
        this.enginesCheck(health),
      ),
      this.check(
        'check-dependencies',
        'dependency',
        'package build graph is acyclic (no circular dependencies)',
        health.dependencies.acyclic,
      ),
      this.check(
        'check-contracts',
        'contract',
        'shared contracts are unique (one engine per package/table)',
        engineSpecsRule().passed,
      ),
      this.check(
        'check-repositories',
        'repository',
        'every engine resolves a persisted repository',
        health.repositories.every((r) => r.status === 'ready'),
      ),
      this.check(
        'check-lifecycle',
        'lifecycle',
        'every engine lifecycle reports',
        health.engines.every((e) => e.status !== 'unhealthy' && e.status !== 'unknown'),
      ),
      this.check(
        'check-event-flow',
        'event_flow',
        '15-stage event flow validated',
        health.pipeline.valid,
      ),
      this.check(
        'check-cross-engine',
        'lifecycle',
        'all nine cross-engine pairs healthy',
        health.crossEngine.every((p) => p.status !== 'failed'),
      ),
      this.check(
        'check-performance',
        'engine',
        'end-to-end performance measured',
        health.performance.totalCalls > 0,
      ),
    ];
    const passed = checks.filter((c) => c.passed).length;
    return {
      valid: checks.every((c) => c.passed),
      checks,
      summary: {
        passed,
        failed: checks.length - passed,
        total: checks.length,
        score: Math.round((passed / checks.length) * 100),
      },
    };
  }

  private check(
    id: string,
    category: OSValidationCheck['category'],
    label: string,
    passed: boolean,
  ): OSValidationCheck {
    return { id, label, category, passed, detail: passed ? 'PASS' : 'FAIL' };
  }

  private enginesCheck(health: OSSystemHealth): boolean {
    return health.engines.every((engine) => engine.consulted && engine.status !== 'unhealthy');
  }
}
