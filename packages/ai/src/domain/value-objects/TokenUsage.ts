// ──────────────────────────────────────────────────────────────────
// VedMoulya — TokenUsage Value Object
// Tracks token consumption for AI requests
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

export class TokenUsage {
  private constructor(
    public readonly input: number,
    public readonly output: number,
  ) {
    if (input < 0) throw new Error('Input tokens must be non-negative');
    if (output < 0) throw new Error('Output tokens must be non-negative');
  }

  static create(input: number, output: number): TokenUsage {
    return new TokenUsage(input, output);
  }

  get total(): number {
    return this.input + this.output;
  }

  add(other: TokenUsage): TokenUsage {
    return new TokenUsage(this.input + other.input, this.output + other.output);
  }

  equals(other: TokenUsage): boolean {
    return this.input === other.input && this.output === other.output;
  }

  toJSON(): { input: number; output: number; total: number } {
    return { input: this.input, output: this.output, total: this.total };
  }
}
