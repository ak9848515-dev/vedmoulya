// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionVersion
// Version tracking for decision entities
// ──────────────────────────────────────────────────────────────────

/**
 * DecisionVersion value object.
 * Every significant change to a decision increments its version.
 * Major: decision outcome changes, re-evaluation
 * Minor: option changes, evidence changes
 * Patch: metadata updates, description changes
 */
export class DecisionVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number;

  constructor(major: number = 1, minor: number = 0, patch: number = 0) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
  }

  static initial(): DecisionVersion {
    return new DecisionVersion(1, 0, 0);
  }

  bumpPatch(): DecisionVersion {
    return new DecisionVersion(this._major, this._minor, this._patch + 1);
  }

  bumpMinor(): DecisionVersion {
    return new DecisionVersion(this._major, this._minor + 1, 0);
  }

  bumpMajor(): DecisionVersion {
    return new DecisionVersion(this._major + 1, 0, 0);
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

  isNewerThan(other: DecisionVersion): boolean {
    if (this._major !== other._major) return this._major > other._major;
    if (this._minor !== other._minor) return this._minor > other._minor;
    return this._patch > other._patch;
  }

  equals(other: DecisionVersion): boolean {
    return (
      this._major === other._major && this._minor === other._minor && this._patch === other._patch
    );
  }

  toString(): string {
    return this.label;
  }
}
