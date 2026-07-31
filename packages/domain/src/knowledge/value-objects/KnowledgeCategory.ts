// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeCategory
// Classification dimension for knowledge graph entities
// ──────────────────────────────────────────────────────────────────

export type KnowledgeCategoryValue =
  | 'user'
  | 'goal'
  | 'skill'
  | 'knowledge'
  | 'mission'
  | 'project'
  | 'task'
  | 'habit'
  | 'learning'
  | 'course'
  | 'book'
  | 'career'
  | 'job'
  | 'interview'
  | 'company'
  | 'business'
  | 'client'
  | 'service'
  | 'income'
  | 'expense'
  | 'decision'
  | 'problem'
  | 'opportunity'
  | 'achievement'
  | 'milestone'
  | 'portfolio'
  | 'document'
  | 'conversation'
  | 'memory'
  | 'relationship'
  | 'timeline_event'
  | 'competency'
  | 'evidence'
  | 'artifact'
  | 'reference';

/**
 * KnowledgeCategory value object.
 * Categorizes every node in the knowledge graph by its semantic type.
 */
export class KnowledgeCategory {
  private readonly _value: KnowledgeCategoryValue;

  private constructor(value: KnowledgeCategoryValue) {
    this._value = value;
  }

  static create(value: string): KnowledgeCategory {
    if (!isValidCategory(value)) {
      throw new Error(`Invalid knowledge category: ${value}`);
    }
    return new KnowledgeCategory(value);
  }

  static user(): KnowledgeCategory {
    return new KnowledgeCategory('user');
  }

  static goal(): KnowledgeCategory {
    return new KnowledgeCategory('goal');
  }

  static skill(): KnowledgeCategory {
    return new KnowledgeCategory('skill');
  }

  static knowledge(): KnowledgeCategory {
    return new KnowledgeCategory('knowledge');
  }

  static project(): KnowledgeCategory {
    return new KnowledgeCategory('project');
  }

  static learning(): KnowledgeCategory {
    return new KnowledgeCategory('learning');
  }

  static decision(): KnowledgeCategory {
    return new KnowledgeCategory('decision');
  }

  static career(): KnowledgeCategory {
    return new KnowledgeCategory('career');
  }

  static business(): KnowledgeCategory {
    return new KnowledgeCategory('business');
  }

  static evidence(): KnowledgeCategory {
    return new KnowledgeCategory('evidence');
  }

  static competency(): KnowledgeCategory {
    return new KnowledgeCategory('competency');
  }

  static artifact(): KnowledgeCategory {
    return new KnowledgeCategory('artifact');
  }

  static memory(): KnowledgeCategory {
    return new KnowledgeCategory('memory');
  }

  static portfolio(): KnowledgeCategory {
    return new KnowledgeCategory('portfolio');
  }

  static reference(): KnowledgeCategory {
    return new KnowledgeCategory('reference');
  }

  get value(): KnowledgeCategoryValue {
    return this._value;
  }

  equals(other: KnowledgeCategory): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

function isValidCategory(value: string): value is KnowledgeCategoryValue {
  const valid: KnowledgeCategoryValue[] = [
    'user',
    'goal',
    'skill',
    'knowledge',
    'mission',
    'project',
    'task',
    'habit',
    'learning',
    'course',
    'book',
    'career',
    'job',
    'interview',
    'company',
    'business',
    'client',
    'service',
    'income',
    'expense',
    'decision',
    'problem',
    'opportunity',
    'achievement',
    'milestone',
    'portfolio',
    'document',
    'conversation',
    'memory',
    'relationship',
    'timeline_event',
    'competency',
    'evidence',
    'artifact',
    'reference',
  ];
  return (valid as string[]).includes(value);
}
