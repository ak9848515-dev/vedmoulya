// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeVersion
// Versioning metadata for knowledge graph entities
// ──────────────────────────────────────────────────────────────────

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

/**
 * KnowledgeVersion value object.
 * Tracks the version of a knowledge entity following semver.
 */
export class KnowledgeVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number;
  private readonly _versionString: string;

  constructor(major: number = 1, minor: number = 0, patch: number = 0) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
    this._versionString = `${String(major)}.${String(minor)}.${String(patch)}`;
  }

  static initial(): KnowledgeVersion {
    return new KnowledgeVersion(1, 0, 0);
  }

  static fromString(version: string): KnowledgeVersion {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid version string: ${version}`);
    }
    return new KnowledgeVersion(parts[0], parts[1], parts[2]);
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

  bumpMajor(): KnowledgeVersion {
    return new KnowledgeVersion(this._major + 1, 0, 0);
  }

  bumpMinor(): KnowledgeVersion {
    return new KnowledgeVersion(this._major, this._minor + 1, 0);
  }

  bumpPatch(): KnowledgeVersion {
    return new KnowledgeVersion(this._major, this._minor, this._patch + 1);
  }

  isNewerThan(other: KnowledgeVersion): boolean {
    if (this._major !== other._major) return this._major > other._major;
    if (this._minor !== other._minor) return this._minor > other._minor;
    return this._patch > other._patch;
  }

  equals(other: KnowledgeVersion): boolean {
    return (
      this._major === other._major && this._minor === other._minor && this._patch === other._patch
    );
  }

  toString(): string {
    return this._versionString;
  }

  toInfo(): VersionInfo {
    return { major: this._major, minor: this._minor, patch: this._patch };
  }
}
