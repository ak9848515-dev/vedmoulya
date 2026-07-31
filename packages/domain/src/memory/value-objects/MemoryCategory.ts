// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryCategory
// Classification dimension for memory entries
// Memory is NOT knowledge — memory stores experience, observation,
// history, reflection, and context.
// ──────────────────────────────────────────────────────────────────

export type MemoryCategoryValue =
  | 'observation'
  | 'experience'
  | 'reflection'
  | 'context'
  | 'history'
  | 'conversation'
  | 'insight'
  | 'lesson'
  | 'pattern'
  | 'preference'
  | 'routine'
  | 'interaction'
  | 'feedback'
  | 'mood'
  | 'event';

/**
 * MemoryCategory value object.
 * Categorizes memory entries by their semantic type.
 * Memory stores experiential data, NOT semantic truth (that's Knowledge Graph).
 */
export class MemoryCategory {
  private readonly _value: MemoryCategoryValue;

  private constructor(value: MemoryCategoryValue) {
    this._value = value;
  }

  static create(value: string): MemoryCategory {
    if (!isValidCategory(value)) {
      throw new Error(`Invalid memory category: ${value}`);
    }
    return new MemoryCategory(value);
  }

  static observation(): MemoryCategory {
    return new MemoryCategory('observation');
  }
  static experience(): MemoryCategory {
    return new MemoryCategory('experience');
  }
  static reflection(): MemoryCategory {
    return new MemoryCategory('reflection');
  }
  static context(): MemoryCategory {
    return new MemoryCategory('context');
  }
  static history(): MemoryCategory {
    return new MemoryCategory('history');
  }
  static conversation(): MemoryCategory {
    return new MemoryCategory('conversation');
  }
  static insight(): MemoryCategory {
    return new MemoryCategory('insight');
  }
  static lesson(): MemoryCategory {
    return new MemoryCategory('lesson');
  }
  static pattern(): MemoryCategory {
    return new MemoryCategory('pattern');
  }
  static preference(): MemoryCategory {
    return new MemoryCategory('preference');
  }
  static routine(): MemoryCategory {
    return new MemoryCategory('routine');
  }
  static interaction(): MemoryCategory {
    return new MemoryCategory('interaction');
  }
  static feedback(): MemoryCategory {
    return new MemoryCategory('feedback');
  }
  static mood(): MemoryCategory {
    return new MemoryCategory('mood');
  }
  static event(): MemoryCategory {
    return new MemoryCategory('event');
  }

  get value(): MemoryCategoryValue {
    return this._value;
  }

  equals(other: MemoryCategory): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

function isValidCategory(value: string): value is MemoryCategoryValue {
  const valid: MemoryCategoryValue[] = [
    'observation',
    'experience',
    'reflection',
    'context',
    'history',
    'conversation',
    'insight',
    'lesson',
    'pattern',
    'preference',
    'routine',
    'interaction',
    'feedback',
    'mood',
    'event',
  ];
  return (valid as string[]).includes(value);
}
