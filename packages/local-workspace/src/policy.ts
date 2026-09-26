// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Workspace — ignore rules & binary detection
//
// Two independent, NON-OVERRIDABLE policies:
//   • IGNORED_NAMES  — dot-files plus build/vendor/system directories that are
//     never listed and never entered.
//   • BINARY_EXTENSIONS — extensions whose contents are never returned as text.
//
// Everything here is pure: no filesystem, no environment, no platform checks.
// ─────────────────────────────────────────────────────────────────────────────

/** Exact directory/file names that are ALWAYS ignored (never listed). */
export const IGNORED_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'venv',
  '__pycache__',
  '$RECYCLE.BIN',
  'System Volume Information',
  'Thumbs.db',
  'desktop.ini',
]);

/** Lower-cased `dist`/`.next` style variants are handled by lower-casing. */
const IGNORED_NAMES_LOWER: ReadonlySet<string> = new Set(
  [...IGNORED_NAMES].map((name) => name.toLowerCase()),
);

/**
 * Names always ignored. The caller passes a single path segment (no separators).
 * Dot-prefixed names are ignored; the named build/vendor/system entries are
 * ignored case-insensitively; the `~$` prefix (Office lock files) is ignored.
 */
export function isIgnoredName(name: string): boolean {
  if (name === '' || name === '.' || name === '..') return true;
  if (name.startsWith('.')) return true;
  if (name.startsWith('~$')) return true;
  return IGNORED_NAMES_LOWER.has(name.toLowerCase());
}

/** Extensions whose bytes are never returned as text. */
export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.mp4',
  '.mp3',
  '.wasm',
  '.class',
  '.o',
  '.a',
  '.db',
  '.sqlite',
  '.pyc',
]);

/** True when the extension alone proves the file is binary. */
export function isBinaryExtension(nameOrPath: string): boolean {
  const dot = nameOrPath.lastIndexOf('.');
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(nameOrPath.slice(dot).toLowerCase());
}

/**
 * Sniff a byte prefix for binary content: a NUL byte, a UTF-8 BOM-less
 * replacement character, or a high ratio of non-text bytes all mean "binary".
 * Deterministic and cheap — only the prefix is inspected.
 */
export function looksBinary(prefix: Uint8Array): boolean {
  if (prefix.length === 0) return false;
  for (const byte of prefix) {
    if (byte === 0) return true;
  }
  return false;
}

/** True when a decoded string lost data to invalid UTF-8 (U+FFFD). */
export function hasInvalidUtf8(decoded: string): boolean {
  return decoded.includes('\uFFFD');
}
