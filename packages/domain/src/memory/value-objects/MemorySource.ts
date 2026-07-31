// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemorySource
// Provenance/origin of a memory entry
// ──────────────────────────────────────────────────────────────────

export type MemorySourceType =
  | 'user_input'
  | 'ai_inference'
  | 'system_generated'
  | 'import'
  | 'integration'
  | 'conversation'
  | 'observation'
  | 'reflection';

/**
 * MemorySource value object.
 * Tracks where a memory came from for provenance and confidence scoring.
 */
export class MemorySource {
  private readonly _type: MemorySourceType;
  private readonly _detail: string;
  private readonly _timestamp: Date;

  constructor(type: MemorySourceType, detail: string, timestamp?: Date) {
    this._type = type;
    this._detail = detail;
    this._timestamp = timestamp ?? new Date();
  }

  static userInput(detail: string): MemorySource {
    return new MemorySource('user_input', detail);
  }
  static aiInference(detail: string): MemorySource {
    return new MemorySource('ai_inference', detail);
  }
  static systemGenerated(detail: string): MemorySource {
    return new MemorySource('system_generated', detail);
  }
  static importSource(detail: string): MemorySource {
    return new MemorySource('import', detail);
  }
  static integration(detail: string): MemorySource {
    return new MemorySource('integration', detail);
  }
  static conversation(detail: string): MemorySource {
    return new MemorySource('conversation', detail);
  }
  static observation(detail: string): MemorySource {
    return new MemorySource('observation', detail);
  }
  static reflection(detail: string): MemorySource {
    return new MemorySource('reflection', detail);
  }

  get type(): MemorySourceType {
    return this._type;
  }
  get detail(): string {
    return this._detail;
  }
  get timestamp(): Date {
    return this._timestamp;
  }

  equals(other: MemorySource): boolean {
    return this._type === other._type && this._detail === other._detail;
  }

  toString(): string {
    return `${this._type}: ${this._detail}`;
  }
}
