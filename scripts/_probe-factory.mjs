import { generateProject } from './packages/app-factory/src/catalog/generator.ts';
import { ValidationPipeline } from './packages/app-factory/src/domain/ValidationPipeline.ts';
import { SpecificationEngine } from './packages/app-factory/src/domain/SpecificationEngine.ts';
import { ArchitectureEngine } from './packages/app-factory/src/domain/ArchitectureEngine.ts';
import { DEFAULT_EXECUTION_POLICY } from './packages/app-factory/src/domain/ExecutionPolicy.ts';

const specEngine = new SpecificationEngine();
const archEngine = new ArchitectureEngine();
const pipeline = new ValidationPipeline();
const spec = specEngine.derive({ applicationId: 'app-1', owner: 'u1', goal: 'Build a modern restaurant ordering application.' });
const arch = archEngine.derive({ specification: spec });
const files = generateProject(spec.archetype, { applicationId: 'app-1', name: spec.name });
const { report } = pipeline.run({ applicationId: 'app-1', files, architecture: arch, specification: spec, fileOperations: [], policy: DEFAULT_EXECUTION_POLICY }, { hasAdminViews: true });
for (const g of report.gates) {
  console.log(g.passed ? 'PASS' : 'FAIL', g.gate, JSON.stringify(g.findings.slice(0, 4)));
}
console.log('OVERALL', report.overall, 'files', files.map(f => f.path).join(','));
