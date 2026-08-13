// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: CapabilityVersion
// Semantic-ish version for capabilities (major.minor.patch)
// ──────────────────────────────────────────────────────────────────

export class CapabilityVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number;

  private constructor(major: number, minor: number, patch: number) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
  }

  static initial(): CapabilityVersion {
    return new CapabilityVersion(1, 0, 0);
  }

  static fromString(value: string): CapabilityVersion {
    const parts = value.split('.').map((p) => Number.parseInt(p, 10));
    const major = parts[0] ?? 1;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    return new CapabilityVersion(
      Number.isFinite(major) ? major : 1,
      Number.isFinite(minor) ? minor : 0,
      Number.isFinite(patch) ? patch : 0,
    );
  }

  /** Breaking change → major bump. */
  bumpMajor(): CapabilityVersion {
    return new CapabilityVersion(this._major + 1, 0, 0);
  }

  /** Additive change → minor bump. */
  bumpMinor(): CapabilityVersion {
    return new CapabilityVersion(this._major, this._minor + 1, 0);
  }

  /** Fix → patch bump. */
  bumpPatch(): CapabilityVersion {
    return new CapabilityVersion(this._major, this._minor, this._patch + 1);
  }

  toString(): string {
    return `${String(this._major)}.${String(this._minor)}.${String(this._patch)}`;
  }

  equals(other: CapabilityVersion): boolean {
    return (
      this._major === other._major && this._minor === other._minor && this._patch === other._patch
    );
  }
}
