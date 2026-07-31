// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeSource
// Tracks the origin of knowledge graph data
// ──────────────────────────────────────────────────────────────────

export type KnowledgeSourceType =
  | 'user_input'
  | 'ai_inference'
  | 'system_generated'
  | 'import'
  | 'integration'
  | 'conversation'
  | 'document'
  | 'learning'
  | 'assessment'
  | 'feedback';

/**
 * KnowledgeSource value object.
 * Identifies who or what created a piece of knowledge.
 */
export class KnowledgeSource {
  private readonly _type: KnowledgeSourceType;
  private readonly _detail: string;
  private readonly _timestamp: Date;

  constructor(type: KnowledgeSourceType, detail: string, timestamp?: Date) {
    this._type = type;
    this._detail = detail;
    this._timestamp = timestamp ?? new Date();
  }

  static userInput(detail: string): KnowledgeSource {
    return new KnowledgeSource('user_input', detail);
  }

  static aiInference(detail: string): KnowledgeSource {
    return new KnowledgeSource('ai_inference', detail);
  }

  static systemGenerated(detail: string): KnowledgeSource {
    return new KnowledgeSource('system_generated', detail);
  }

  static importSource(detail: string): KnowledgeSource {
    return new KnowledgeSource('import', detail);
  }

  static integration(detail: string): KnowledgeSource {
    return new KnowledgeSource('integration', detail);
  }

  static conversation(detail: string): KnowledgeSource {
    return new KnowledgeSource('conversation', detail);
  }

  static document(detail: string): KnowledgeSource {
    return new KnowledgeSource('document', detail);
  }

  static learning(detail: string): KnowledgeSource {
    return new KnowledgeSource('learning', detail);
  }

  get type(): KnowledgeSourceType {
    return this._type;
  }

  get detail(): string {
    return this._detail;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  equals(other: KnowledgeSource): boolean {
    return this._type === other._type && this._detail === other._detail;
  }

  toString(): string {
    return `${this._type}: ${this._detail}`;
  }
}
