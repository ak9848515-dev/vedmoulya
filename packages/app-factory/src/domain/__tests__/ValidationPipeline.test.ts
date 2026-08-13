import { describe, expect, it } from 'vitest';
import { ValidationPipeline } from '../ValidationPipeline.js';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';
import { generateProject } from '../../catalog/generator.js';
import { DEFAULT_EXECUTION_POLICY } from '../ExecutionPolicy.js';

function makeContext(
  applicationId: string,
  goal: string,
  files: Array<{ path: string; content: string }>,
  injectDefects = false,
) {
  const specEngine = new SpecificationEngine();
  const archEngine = new ArchitectureEngine();
  const spec = specEngine.derive({ applicationId, owner: 'u1', goal });
  const arch = archEngine.derive({ specification: spec });
  const generated = generateProject(spec.archetype, {
    applicationId,
    name: spec.name,
    injectDefects,
  });
  return {
    applicationId,
    files: generated,
    architecture: arch,
    specification: spec,
    fileOperations: [],
    policy: DEFAULT_EXECUTION_POLICY,
  };
}

describe('ValidationPipeline — Phase 10', () => {
  const pipeline = new ValidationPipeline();

  it('generated restaurant project passes all gates', () => {
    const ctx = makeContext('app-1', 'Build a modern restaurant ordering application.');
    const { report, fixes } = pipeline.run(ctx, { hasAdminViews: true });
    expect(report.overall).toBe('PASS');
    const gates = report.gates.map((g) => g.gate);
    expect(gates).toContain('lint');
    expect(gates).toContain('typecheck');
    expect(gates).toContain('unit_tests');
    expect(gates).toContain('integration_tests');
    expect(gates).toContain('build');
    expect(gates).toContain('security');
    expect(gates).toContain('ui_quality');
    expect(gates).toContain('ai_critic');
    expect(fixes.length).toBe(0);
  });

  it('a missing test file is auto-fixed (bounded, deterministic)', () => {
    const ctx = makeContext('app-2', 'Build an ABAP debugger.', [], true);
    const { report, fixes } = pipeline.run(ctx, { maxAutoFixes: 3 });
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes.every((f) => f.path.endsWith('.test.ts'))).toBe(true);
    expect(report.automaticFixesApplied).toBe(fixes.length);
  });

  it('security gate blocks on injected secrets', () => {
    const ctx = makeContext('app-3', 'Build an ABAP debugger.');
    const withSecret = ctx.files.map((f) =>
      f.path === 'src/index.ts'
        ? { ...f, content: `${f.content}\nconst TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz123456";\n` }
        : f,
    );
    const { report } = pipeline.run({ ...ctx, files: withSecret });
    const security = report.gates.find((g) => g.gate === 'security');
    expect(security?.passed).toBe(false);
  });

  it('detects unresolved relative imports in generated code', () => {
    const ctx = makeContext('app-4', 'Build a restaurant app.');
    const withBrokenImport = ctx.files.map((f) =>
      f.path === 'src/api/menu.ts'
        ? { ...f, content: `${f.content}\nimport { missing } from './does-not-exist.js';\n` }
        : f,
    );
    const { report } = pipeline.run({ ...ctx, files: withBrokenImport });
    const typecheck = report.gates.find((g) => g.gate === 'typecheck');
    expect(typecheck?.passed).toBe(false);
  });
});
