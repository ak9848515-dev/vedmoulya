// ──────────────────────────────────────────────────────────────────
// VedMoulya — Prompt Value Object
// Immutable prompt representation for AI requests
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

export class Prompt {
  private constructor(
    public readonly systemInstructions: string,
    public readonly userContext: string | null,
    public readonly taskContext: string | null,
    public readonly constraints: readonly string[],
    public readonly safetyInstructions: readonly string[],
    public readonly userInput: string,
  ) {}

  static create(params: {
    systemInstructions: string;
    userContext?: string;
    taskContext?: string;
    constraints?: string[];
    safetyInstructions?: string[];
    userInput: string;
  }): Prompt {
    return new Prompt(
      params.systemInstructions,
      params.userContext ?? null,
      params.taskContext ?? null,
      params.constraints ?? [],
      params.safetyInstructions ?? [],
      params.userInput,
    );
  }

  get estimatedTokens(): number {
    const text = [
      this.systemInstructions,
      this.userContext ?? '',
      this.taskContext ?? '',
      ...this.constraints,
      ...this.safetyInstructions,
      this.userInput,
    ].join(' ');
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  equals(other: Prompt): boolean {
    return (
      this.systemInstructions === other.systemInstructions &&
      this.userContext === other.userContext &&
      this.taskContext === other.taskContext &&
      this.constraints.length === other.constraints.length &&
      this.constraints.every((c, i) => c === other.constraints[i]) &&
      this.safetyInstructions.length === other.safetyInstructions.length &&
      this.safetyInstructions.every((s, i) => s === other.safetyInstructions[i]) &&
      this.userInput === other.userInput
    );
  }
}
