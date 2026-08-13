// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: ArtifactVerifier tests
// SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION (Phase 1)
//
// Deterministic tests over a hermetic fake reader + the real
// NodeArtifactReader over a temp boundary. No network, no secrets.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ArtifactVerifier } from '../domain/ArtifactVerifier.js';
import { NodeArtifactReader } from '../infrastructure/NodeArtifactReader.js';
import type { ArtifactReaderPort } from '../contracts/artifact-ports.js';

// ── Hermetic fake reader ──────────────────────────────────────────
class FakeReader implements ArtifactReaderPort {
  readonly root = '/approved';
  readonly maxBytes = 1000;
  constructor(
    private readonly entries: Map<
      string,
      { content?: string; denied?: boolean; unreadable?: boolean }
    >,
  ) {}
  async read(relativePath: string) {
    const e = this.entries.get(relativePath);
    if (!e) return { found: false, error: 'Not found.' };
    if (e.denied) return { found: false, denied: true, error: 'denied' };
    if (e.unreadable) return { found: true, content: undefined, error: 'unreadable' };
    return { found: true, content: e.content ?? '', byteLength: (e.content ?? '').length };
  }
  async exists(relativePath: string) {
    const e = this.entries.get(relativePath);
    if (!e) return { found: false };
    if (e.denied) return { found: false, denied: true };
    return { found: true };
  }
}

function reader(
  entries: Record<string, { content?: string; denied?: boolean; unreadable?: boolean }>,
): ArtifactReaderPort {
  return new FakeReader(new Map(Object.entries(entries)));
}

const verifierFor = (r: ArtifactReaderPort) => new ArtifactVerifier(r);

describe('ArtifactVerifier — FILE_EXISTS', () => {
  it('passes when the expected file exists', async () => {
    const v = verifierFor(reader({ 'out/report.json': { content: '{}' } }));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_EXISTS', path: 'out/report.json' }]);
    expect(res.passed).toBe(true);
    expect(res.checks[0].status).toBe('PASS');
  });

  it('fails when the expected file is missing (never SUCCESS)', async () => {
    const v = verifierFor(reader({}));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_EXISTS', path: 'out/report.json' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });

  it('fails on an empty file unless emptyAllowed', async () => {
    const v = verifierFor(reader({ 'empty.txt': { content: '' } }));
    const strict = await v.verify([{ checkId: 'a', type: 'FILE_EXISTS', path: 'empty.txt' }]);
    expect(strict.passed).toBe(false);
    const allowed = await v.verify([
      { checkId: 'a', type: 'FILE_EXISTS', path: 'empty.txt', emptyAllowed: true },
    ]);
    expect(allowed.passed).toBe(true);
  });

  it('fails on path traversal (denied)', async () => {
    const v = verifierFor(reader({ '../secret.txt': { denied: true } }));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_EXISTS', path: '../secret.txt' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });
});

describe('ArtifactVerifier — FILE_ABSENT', () => {
  it('passes when a file that must not exist is absent', async () => {
    const v = verifierFor(reader({}));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_ABSENT', path: 'out/leak.tmp' }]);
    expect(res.passed).toBe(true);
    expect(res.checks[0].status).toBe('PASS');
  });

  it('fails when an unexpected file is present', async () => {
    const v = verifierFor(reader({ 'out/leak.tmp': { content: 'x' } }));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_ABSENT', path: 'out/leak.tmp' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });
});

describe('ArtifactVerifier — VALID STRUCTURE (JSON / CSV)', () => {
  it('passes valid JSON and required fields', async () => {
    const v = verifierFor(
      reader({ 'data.json': { content: '{"user":{"name":"A"},"items":[1,2,3]}' } }),
    );
    const res = await v.verify([
      { checkId: 'a', type: 'JSON_VALID', path: 'data.json' },
      {
        checkId: 'b',
        type: 'JSON_FIELD',
        path: 'data.json',
        requiredFields: ['user.name', 'items'],
      },
    ]);
    expect(res.passed).toBe(true);
  });

  it('fails malformed JSON', async () => {
    const v = verifierFor(reader({ 'data.json': { content: '{not json' } }));
    const res = await v.verify([{ checkId: 'a', type: 'JSON_VALID', path: 'data.json' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });

  it('fails when a required field is missing', async () => {
    const v = verifierFor(reader({ 'data.json': { content: '{"user":{"name":"A"}}' } }));
    const res = await v.verify([
      { checkId: 'a', type: 'JSON_FIELD', path: 'data.json', requiredFields: ['user.email'] },
    ]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });

  it('passes a well-formed CSV and fails an inconsistent one', async () => {
    const good = 'name,value\nA,1\nB,2\n';
    const bad = 'name,value\nA,1\nB,2,3\n';
    const v = verifierFor(reader({ 'good.csv': { content: good }, 'bad.csv': { content: bad } }));
    const ok = await v.verify([{ checkId: 'a', type: 'CSV_VALID', path: 'good.csv' }]);
    expect(ok.passed).toBe(true);
    const ko = await v.verify([{ checkId: 'a', type: 'CSV_VALID', path: 'bad.csv' }]);
    expect(ko.passed).toBe(false);
  });
});

describe('ArtifactVerifier — INDEPENDENT CALCULATION', () => {
  it('passes when the recompute matches', async () => {
    const v = verifierFor(reader({ 'calc.json': { content: '{"numbers":[1,2,3,4]}' } }));
    const res = await v.verify([
      {
        checkId: 'a',
        type: 'CALCULATION',
        path: 'calc.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 10 },
      },
    ]);
    expect(res.passed).toBe(true);
  });

  it('fails when the recompute mismatches', async () => {
    const v = verifierFor(reader({ 'calc.json': { content: '{"numbers":[1,2,3,4]}' } }));
    const res = await v.verify([
      {
        checkId: 'a',
        type: 'CALCULATION',
        path: 'calc.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 99 },
      },
    ]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('FAIL');
  });
});

describe('ArtifactVerifier — DRY-RUN evidence', () => {
  it('passes when the safe dry-run evidence contains the expected marker', async () => {
    const v = verifierFor(
      reader({
        'dryrun.log': { content: 'PLAN: would create out/x.csv (dry-run, no changes applied)' },
      }),
    );
    const res = await v.verify([
      { checkId: 'a', type: 'DRY_RUN', path: 'dryrun.log', expectedContent: 'dry-run' },
    ]);
    expect(res.passed).toBe(true);
  });

  it('fails when the dry-run evidence is missing the marker', async () => {
    const v = verifierFor(reader({ 'dryrun.log': { content: 'executed for real' } }));
    const res = await v.verify([
      { checkId: 'a', type: 'DRY_RUN', path: 'dryrun.log', expectedContent: 'dry-run' },
    ]);
    expect(res.passed).toBe(false);
  });
});

describe('ArtifactVerifier — UNKNOWN evidence', () => {
  it('never succeeds when evidence is unavailable (UNKNOWN preserved)', async () => {
    const v = verifierFor(reader({ 'data.json': { unreadable: true } }));
    const res = await v.verify([{ checkId: 'a', type: 'JSON_VALID', path: 'data.json' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('UNKNOWN');
    expect(res.unknownCount).toBe(1);
  });

  it('FILE_EXISTS with unreadable evidence stays UNKNOWN (not SUCCESS)', async () => {
    const v = verifierFor(reader({ 'x.txt': { unreadable: true } }));
    const res = await v.verify([{ checkId: 'a', type: 'FILE_EXISTS', path: 'x.txt' }]);
    expect(res.passed).toBe(false);
    expect(res.checks[0].status).toBe('UNKNOWN');
  });
});
describe('NodeArtifactReader — real filesystem (bounded, confined)', () => {
  it('reads a real file, denies traversal, denies symlink escape, bounds size', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sprint024-reader-'));
    try {
      const root = path.join(dir, 'approved');
      await fs.mkdir(root);
      await fs.writeFile(path.join(root, 'a.json'), '{"ok":true}', 'utf8');
      await fs.writeFile(path.join(dir, 'outside.txt'), 'secret', 'utf8');

      const readerInstance = new NodeArtifactReader(root, 64);

      const read = await readerInstance.read('a.json');
      expect(read.found).toBe(true);
      expect(read.content).toBe('{"ok":true}');

      // Traversal denied.
      const trav = await readerInstance.read('../outside.txt');
      expect(trav.denied).toBe(true);

      // Absolute path denied.
      const abs = await readerInstance.read(path.join(root, 'a.json'));
      expect(abs.denied).toBe(true);

      // Symlink escape denied.
      const link = path.join(root, 'escape.json');
      try {
        await fs.symlink(path.join(dir, 'outside.txt'), link);
      } catch {
        // Symlinks may be unavailable on some platforms — skip that case.
      }
      const linkStat = await fs.stat(link).catch(() => null);
      if (linkStat) {
        const esc = await readerInstance.read('escape.json');
        expect(esc.denied).toBe(true);
      }

      // Size bound → found-but-unreadable (UNKNOWN evidence).
      await fs.writeFile(path.join(root, 'big.txt'), 'x'.repeat(200), 'utf8');
      const big = await readerInstance.read('big.txt');
      expect(big.found).toBe(true);
      expect(big.content).toBeUndefined();
      expect(big.error).toContain('bound');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('StepVerifier.verifyArtifacts + attachArtifacts', () => {
  it('passes only when the execution contract AND the real artifact both verify', async () => {
    const { StepVerifier } = await import('../domain/StepVerifier.js');
    const verifier = new StepVerifier();
    const v = reader({ 'data.json': { content: '{"numbers":[1,2,3,4]}' } });
    const artifact = await verifier.verifyArtifacts(v, [
      { checkId: 'a', type: 'JSON_VALID', path: 'data.json' },
      {
        checkId: 'b',
        type: 'CALCULATION',
        path: 'data.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 10 },
      },
    ]);
    expect(artifact.passed).toBe(true);
    const verification = verifier.attachArtifacts(
      {
        stepId: 's1',
        pre: { passed: true, checks: [] },
        post: {
          passed: true,
          checks: [{ name: 'execution-completed', passed: true, detail: 'ok' }],
        },
      },
      artifact,
    );
    expect(verification.post?.passed).toBe(true);
    expect(verification.post?.checks.length).toBe(3);
  });

  it('fails the combined verification when the artifact contradicts the execution claim', async () => {
    const { StepVerifier } = await import('../domain/StepVerifier.js');
    const verifier = new StepVerifier();
    // Execution CLAIMS success but the artifact is malformed → verification must fail.
    const v = reader({ 'data.json': { content: '{broken' } });
    const artifact = await verifier.verifyArtifacts(v, [
      { checkId: 'a', type: 'JSON_VALID', path: 'data.json' },
    ]);
    expect(artifact.passed).toBe(false);
    const verification = verifier.attachArtifacts(
      {
        stepId: 's1',
        pre: { passed: true, checks: [] },
        post: {
          passed: true,
          checks: [{ name: 'execution-completed', passed: true, detail: 'ok' }],
        },
      },
      artifact,
    );
    expect(verification.post?.passed).toBe(false);
  });
});
