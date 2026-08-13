// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ProviderVersion
// Semantic-ish version for provider definitions (major.minor.patch)
// ──────────────────────────────────────────────────────────────────

export class ProviderVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number;

  private constructor(major: number, minor: number, patch: number) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
  }

  static initial(): ProviderVersion {
    return new ProviderVersion(1, 0, 0);
  }

  static fromString(value: string): ProviderVersion {
    const parts = value.split('.').map((p) => Number.parseInt(p, 10));
    const major = parts[0] ?? 1;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    return new ProviderVersion(
      Number.isFinite(major) ? major : 1,
      Number.isFinite(minor) ? minor : 0,
      Number.isFinite(patch) ? patch : 0,
    );
  }

  bumpMajor(): ProviderVersion {
    return new ProviderVersion(this._major + 1, 0, 0);
  }

  bumpMinor(): ProviderVersion {
    return new ProviderVersion(this._major, this._minor + 1, 0);
  }

  bumpPatch(): ProviderVersion {
    return new ProviderVersion(this._major, this._minor, this._patch + 1);
  }

  toString(): string {
    return `${String(this._major)}.${String(this._minor)}.${String(this._patch)}`;
  }

  equals(other: ProviderVersion): boolean {
    return (
      this._major === other._major && this._minor === other._minor && this._patch === other._patch
    );
  }
}
