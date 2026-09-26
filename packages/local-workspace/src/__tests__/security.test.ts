// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 SECURITY tests — containment, traversal, symlink/junction policy.
//
// Every case here is an ATTACK attempt against the path jail. The contract is
// fail-closed: a violation returns a typed `PATH_NOT_ALLOWED`, never a leaked
// absolute path, never raw OS error text, and never a filesystem read.
//
// The security logic is exercised through the injected `WorkspaceFileSystem`
// double, so the assertions are deterministic on every platform (including
// Windows, where the real separators, case folding and trailing-dot rules are
// simulated explicitly).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { WorkspacePathResolver, rejectionForRawPath } from '../path-resolver.js';
import { FakeWorkspaceFileSystem } from './fake-fs.js';

const POSIX = { separator: '/', caseInsensitive: false };
const WINDOWS = { separator: '\\', caseInsensitive: true };

/** A resolver over a POSIX fixture with `/ws` (inside) and `/etc` (outside). */
function posix(): { fs: FakeWorkspaceFileSystem; resolver: WorkspacePathResolver } {
  const fs = new FakeWorkspaceFileSystem();
  fs.addDirectory('/ws');
  fs.addDirectory('/ws/src');
  fs.addFile('/ws/src/index.ts', 'export {};');
  fs.addFile('/ws/README.md', '# hi');
  fs.addDirectory('/etc');
  fs.addFile('/etc/passwd', 'root:x:0:0');
  fs.addDirectory('/outside');
  fs.addFile('/outside/secret.txt', 'secret');
  const resolver = new WorkspacePathResolver(fs, POSIX);
  return { fs, resolver };
}

/** A resolver over a Windows fixture, with real Windows containment semantics. */
function windows(): { fs: FakeWorkspaceFileSystem; resolver: WorkspacePathResolver } {
  const fs = new FakeWorkspaceFileSystem({ caseInsensitive: true });
  fs.addDirectory('C:/ws');
  fs.addDirectory('C:/ws/src');
  fs.addFile('C:/ws/src/index.ts', 'export {};');
  fs.addDirectory('C:/Windows');
  fs.addFile('C:/Windows/system.ini', 'x');
  const resolver = new WorkspacePathResolver(fs, WINDOWS);
  return { fs, resolver };
}

describe('SECURITY — containment (POSIX)', () => {
  it.each([
    ['../../etc/passwd', 'parent traversal'],
    ['../etc/passwd', 'single parent traversal'],
    ['src/../../etc/passwd', 'nested traversal'],
    ['src/../../../etc/passwd', 'deep nested traversal'],
    ['..', 'bare parent'],
    ['src/..', 'trailing parent'],
    ['/ws/src/index.ts', 'absolute path inside root is still refused'],
  ])('rejects %s (%s)', async (path) => {
    const { resolver } = posix();
    const result = await resolver.resolveInside('/ws', '/ws', path, { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('cannot escape via repeated-dot obfuscation', async () => {
    // `....//....//etc/passwd` has no literal `..` segment (each segment is
    // `....`), so it is refused as a non-existent name inside the root — it can
    // never reach `/etc`. The security property is "stays inside", not the
    // particular kind.
    const { resolver } = posix();
    const result = await resolver.resolveInside('/ws', '/ws', '....//....//etc/passwd', {
      expect: 'file',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['PATH_NOT_FOUND', 'PATH_NOT_ALLOWED']).toContain(result.error.kind);
      expect(result.error.message).not.toContain('/etc');
    }
  });

  it.each([
    ['..%2f..%2fetc%2fpasswd', 'percent-encoded separators'],
    ['%2e%2e%2fetc%2fpasswd', 'percent-encoded dots'],
    ['..%5c..%5cetc%5cpasswd', 'percent-encoded backslashes'],
    ['....%2f%2fetc', 'encoded repeated dots'],
  ])('does NOT decode %s (%s) into a traversal', async (path) => {
    // The resolver receives the raw string. An encoded payload has no literal
    // `..` segment, so it is treated as an ordinary (non-existent) name — it can
    // never resolve outside the root. A decoded traversal, if ever produced
    // upstream, is refused by the raw-`..` rule above.
    const { resolver } = posix();
    const result = await resolver.resolveInside('/ws', '/ws', path, { expect: 'any' });
    if (result.ok) {
      // If accepted at all, it stayed inside the workspace.
      expect(result.value.absolute.startsWith('/ws')).toBe(true);
      expect(result.value.relative).not.toContain('..');
    } else {
      expect(['PATH_NOT_ALLOWED', 'PATH_NOT_FOUND']).toContain(result.error.kind);
    }
  });

  it('rejects a NUL byte in a path', async () => {
    const { resolver } = posix();
    const result = await resolver.resolveInside('/ws', '/ws', 'src/\0index.ts', { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('accepts a normal nested path and reports it relative', async () => {
    const { resolver } = posix();
    const result = await resolver.resolveInside('/ws', '/ws', 'src/index.ts', { expect: 'file' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.relative).toBe('src/index.ts');
      expect(result.value.relative.startsWith('/')).toBe(false);
    }
  });
});

describe('SECURITY — containment (Windows semantics)', () => {
  it.each([
    ['C:\\Windows\\system.ini', 'drive-absolute path'],
    ['C:/Windows/system.ini', 'drive-absolute path (slashes)'],
    ['C:Windows\\system.ini', 'drive-relative path'],
    ['C:foo', 'bare drive-relative path'],
    ['\\\\server\\share\\secret', 'UNC path'],
    ['//server/share/secret', 'UNC path (slashes)'],
    ['..\\..\\Windows\\system.ini', 'backslash traversal'],
    ['src\\..\\..\\Windows', 'mixed-separator traversal'],
    ['..', 'bare parent'],
  ])('rejects %s (%s)', async (path) => {
    const { resolver } = windows();
    const result = await resolver.resolveInside('C:\\ws', 'C:/ws', path, { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses trailing-dot / trailing-space segments (Windows strips them)', async () => {
    const { resolver } = windows();
    for (const path of ['src/.. ', 'src/..  ', 'src/. ', 'src\\..\\']) {
      const result = await resolver.resolveInside('C:\\ws', 'C:/ws', path, { expect: 'any' });
      expect(result.ok).toBe(false);
    }
  });

  it('treats containment case-insensitively on Windows', async () => {
    const { resolver } = windows();
    // `C:\WS\SRC\INDEX.TS` is the SAME file as `C:\ws\src\index.ts` on Windows.
    // The differently-cased relative path must resolve INSIDE the root.
    const walk = await resolver.resolveInside('C:\\ws', 'C:/ws', 'SRC\\INDEX.TS', {
      expect: 'file',
    });
    expect(walk.ok).toBe(true);
    if (walk.ok) expect(walk.value.relative).toBe('SRC/INDEX.TS');

    // A differently-cased SIBLING is not contained on Windows either way.
    const sibling = await resolver.resolveInside('C:\\ws', 'C:/ws', '..\\WS-EVIL\\x', {
      expect: 'any',
    });
    expect(sibling.ok).toBe(false);
  });

  it('does NOT treat a sibling directory as contained on Windows', async () => {
    const { resolver } = windows();
    const result = await resolver.resolveInside('C:\\ws', 'C:/ws', '..\\ws-evil\\x', {
      expect: 'any',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('reports raw-path rejections through the pure helper too', () => {
    expect(rejectionForRawPath('..\\etc', true)).not.toBeNull();
    expect(rejectionForRawPath('C:foo', true)).not.toBeNull();
    expect(rejectionForRawPath('src/.. ', true)).not.toBeNull();
    expect(rejectionForRawPath('src/index.ts', true)).toBeNull();
  });
});

describe('SECURITY — symlink & junction policy (fail-closed)', () => {
  it('refuses a symlink whose target is OUTSIDE the root', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addDirectory('/outside');
    fs.addFile('/outside/secret.txt', 'secret');
    fs.addSymlink('/ws/escape', '/outside');
    const resolver = new WorkspacePathResolver(fs, POSIX);

    const result = await resolver.resolveInside('/ws', '/ws', 'escape/secret.txt', {
      expect: 'file',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses a symlinked INTERMEDIATE directory even when the target is inside', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addDirectory('/ws/real');
    fs.addFile('/ws/real/a.txt', 'ok');
    fs.addSymlink('/ws/via', '/ws/real');
    const resolver = new WorkspacePathResolver(fs, POSIX);

    const result = await resolver.resolveInside('/ws', '/ws', 'via/a.txt', { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses a symlink leaf pointing at an in-root file', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addFile('/ws/real.txt', 'ok');
    fs.addSymlink('/ws/alias.txt', '/ws/real.txt');
    const resolver = new WorkspacePathResolver(fs, POSIX);

    const result = await resolver.resolveInside('/ws', '/ws', 'alias.txt', { expect: 'file' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses a dangling symlink', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addSymlink('/ws/dangling', '/does/not/exist');
    const resolver = new WorkspacePathResolver(fs, POSIX);

    const result = await resolver.resolveInside('/ws', '/ws', 'dangling', { expect: 'any' });
    expect(result.ok).toBe(false);
  });

  it('refuses a junction/reparse-style escape via the realpath backstop', async () => {
    // Simulate a junction the component walk cannot see: the lstat says
    // `directory`, but realpath lands outside the root. The realpath check must
    // catch it — this is the defense-in-depth layer for Windows reparse points.
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addDirectory('/ws/junction');
    const resolver = new WorkspacePathResolver(fs, POSIX);

    // `rootReal` differs from the walk root, so the target's realpath is outside.
    const result = await resolver.resolveInside('/ws', '/somewhere/else', 'junction', {
      expect: 'directory',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });

  it('still refuses a realpath escape when symlinks are explicitly allowed', async () => {
    // `allowSymlinks` is a hardening-test escape hatch: the realpath containment
    // check must remain the backstop, so an escape is STILL refused.
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addDirectory('/outside');
    fs.addSymlink('/ws/escape', '/outside');
    const resolver = new WorkspacePathResolver(fs, { ...POSIX, allowSymlinks: true });

    const result = await resolver.resolveInside('/ws', '/ws', 'escape', { expect: 'directory' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('PATH_NOT_ALLOWED');
  });
  it('allows an in-root symlink target ONLY when symlinks are explicitly enabled', async () => {
    const fs = new FakeWorkspaceFileSystem();
    fs.addDirectory('/ws');
    fs.addDirectory('/ws/real');
    fs.addSymlink('/ws/via', '/ws/real');

    const closed = new WorkspacePathResolver(fs, POSIX);
    expect((await closed.resolveInside('/ws', '/ws', 'via', { expect: 'any' })).ok).toBe(false);

    const open = new WorkspacePathResolver(fs, { ...POSIX, allowSymlinks: true });
    const result = await open.resolveInside('/ws', '/ws', 'via', { expect: 'directory' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.relative).toBe('via');
  });
});

describe('SECURITY — error hygiene', () => {
  it('never includes an absolute path in an error message or path field', async () => {
    const { resolver } = posix();
    for (const raw of ['../../etc/passwd', '/etc/passwd', 'C:\\Windows\\x', '..']) {
      const result = await resolver.resolveInside('/ws', '/ws', raw, { expect: 'file' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).not.toContain('/ws');
        expect(result.error.message).not.toContain('/etc');
        expect(result.error.message).not.toContain('C:\\');
        if (result.error.path !== undefined) {
          expect(result.error.path.startsWith('/')).toBe(false);
          expect(result.error.path.includes('..')).toBe(false);
        }
      }
    }
  });

  it('never surfaces raw OS error text', async () => {
    const { resolver } = posix();
    for (const raw of ['missing.txt', 'src/nope.ts', '../../etc']) {
      const result = await resolver.resolveInside('/ws', '/ws', raw, { expect: 'file' });
      if (!result.ok) {
        expect(result.error.message).not.toMatch(/ENOENT|EACCES|EPERM|ELOOP|ENOTDIR/);
        expect(result.error.message).not.toMatch(/[A-Za-z]:\\/);
      }
    }
  });
});
