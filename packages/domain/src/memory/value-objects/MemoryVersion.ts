// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryVersion
// Version tracking for memory entries
// ──────────────────────────────────────────────────────────────────

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

/**
 * MemoryVersion value object.
 * Every mutation to a memory increments its version.
 * Enables conflict resolution and history tracking.
 */
export class MemoryVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number;

  constructor(major: number = 1, minor: number = 0, patch: number = 0) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
  }

  static initial(): MemoryVersion {
    return new MemoryVersion(1, 0, 0);
  }

  /** Increment patch version (minor changes) */
  bumpPatch(): MemoryVersion {
    return new MemoryVersion(this._major, this._minor, this._patch + 1);
  }

  /** Increment minor version (significant changes) */
  bumpMinor(): MemoryVersion {
    return new MemoryVersion(this._major, this._minor + 1, 0);
  }

  /** Increment major version (breaking changes) */
  bumpMajor(): MemoryVersion {
    return new MemoryVersion(this._major + 1, 0, 0);
  }

  get major(): number {
    return this._major;
  }
  get minor(): number {
    return this._minor;
  }
  get patch(): number {
    return this._patch;
  }

  get label(): string {
    return `v${String(this._major)}.${String(this._minor)}.${String(this._patch)}`;
  }

  isNewerThan(other: MemoryVersion): boolean {
    if (this._major !== other._major) return this._major > other._major;
    if (this._minor !== other._minor) return this._minor > other._minor;
    return this._patch > other._patch;
  }

  equals(other: MemoryVersion): boolean {
    return (
      this._major === other._major && this._minor === other._minor && this._patch === other._patch
    );
  }

  toString(): string {
    return this.label;
  }
}
