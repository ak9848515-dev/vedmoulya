// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: RelationshipType
// Typed relationships between knowledge graph entities
// ARC-003/D03 — Relationship Model
// ──────────────────────────────────────────────────────────────────

export type RelationshipCategory =
  | 'ownership'
  | 'progression'
  | 'dependency'
  | 'causality'
  | 'composition'
  | 'association'
  | 'temporal';

/**
 * RelationshipType value object.
 * Every relationship in the knowledge graph must be typed.
 */
export class RelationshipType {
  private readonly _type: string;
  private readonly _category: RelationshipCategory;
  private readonly _label: string;

  constructor(type: string, category: RelationshipCategory, label: string) {
    this._type = type;
    this._category = category;
    this._label = label;
  }

  // ── Relationship Definitions (ARC-003/D03) ────────────────────────

  static HAS_GOAL(): RelationshipType {
    return new RelationshipType('HAS_GOAL', 'ownership', 'has goal');
  }

  static HAS_SKILL(): RelationshipType {
    return new RelationshipType('HAS_SKILL', 'ownership', 'has skill');
  }

  static HAS_KNOWLEDGE(): RelationshipType {
    return new RelationshipType('HAS_KNOWLEDGE', 'ownership', 'has knowledge');
  }

  static LEARNED(): RelationshipType {
    return new RelationshipType('LEARNED', 'progression', 'learned');
  }

  static IMPROVES(): RelationshipType {
    return new RelationshipType('IMPROVES', 'progression', 'improves');
  }

  static WORKS_ON(): RelationshipType {
    return new RelationshipType('WORKS_ON', 'ownership', 'works on');
  }

  static PART_OF(): RelationshipType {
    return new RelationshipType('PART_OF', 'composition', 'part of');
  }

  static DEPENDS_ON(): RelationshipType {
    return new RelationshipType('DEPENDS_ON', 'dependency', 'depends on');
  }

  static COMPLETED(): RelationshipType {
    return new RelationshipType('COMPLETED', 'progression', 'completed');
  }

  static BLOCKED_BY(): RelationshipType {
    return new RelationshipType('BLOCKED_BY', 'dependency', 'blocked by');
  }

  static RESULTED_IN(): RelationshipType {
    return new RelationshipType('RESULTED_IN', 'causality', 'resulted in');
  }

  static CAUSED(): RelationshipType {
    return new RelationshipType('CAUSED', 'causality', 'caused');
  }

  static EARNED_FROM(): RelationshipType {
    return new RelationshipType('EARNED_FROM', 'association', 'earned from');
  }

  static SPENT_ON(): RelationshipType {
    return new RelationshipType('SPENT_ON', 'association', 'spent on');
  }

  static CONNECTED_TO(): RelationshipType {
    return new RelationshipType('CONNECTED_TO', 'association', 'connected to');
  }

  static RELATED_TO(): RelationshipType {
    return new RelationshipType('RELATED_TO', 'association', 'related to');
  }

  static SUPPORTS(): RelationshipType {
    return new RelationshipType('SUPPORTS', 'progression', 'supports');
  }

  static CREATED(): RelationshipType {
    return new RelationshipType('CREATED', 'ownership', 'created');
  }

  static RECOMMENDED_BY(): RelationshipType {
    return new RelationshipType('RECOMMENDED_BY', 'association', 'recommended by');
  }

  static INFLUENCED(): RelationshipType {
    return new RelationshipType('INFLUENCED', 'causality', 'influenced');
  }

  static APPLIED_FOR(): RelationshipType {
    return new RelationshipType('APPLIED_FOR', 'association', 'applied for');
  }

  static OFFERED(): RelationshipType {
    return new RelationshipType('OFFERED', 'association', 'offered');
  }

  static MENTORED_BY(): RelationshipType {
    return new RelationshipType('MENTORED_BY', 'association', 'mentored by');
  }

  static ATTENDED(): RelationshipType {
    return new RelationshipType('ATTENDED', 'temporal', 'attended');
  }

  static OCCURRED_AT(): RelationshipType {
    return new RelationshipType('OCCURRED_AT', 'temporal', 'occurred at');
  }

  static REFINES(): RelationshipType {
    return new RelationshipType('REFINES', 'progression', 'refines');
  }

  static VALIDATES(): RelationshipType {
    return new RelationshipType('VALIDATES', 'progression', 'validates');
  }

  static EVIDENCES(): RelationshipType {
    return new RelationshipType('EVIDENCES', 'association', 'evidences');
  }

  static REFERENCES(): RelationshipType {
    return new RelationshipType('REFERENCES', 'association', 'references');
  }

  // ── Custom ────────────────────────────────────────────────────────

  static custom(type: string, category: RelationshipCategory, label: string): RelationshipType {
    return new RelationshipType(type, category, label);
  }

  get type(): string {
    return this._type;
  }

  get category(): RelationshipCategory {
    return this._category;
  }

  get label(): string {
    return this._label;
  }

  isOwnership(): boolean {
    return this._category === 'ownership';
  }

  isProgression(): boolean {
    return this._category === 'progression';
  }

  isDependency(): boolean {
    return this._category === 'dependency';
  }

  isCausality(): boolean {
    return this._category === 'causality';
  }

  isComposition(): boolean {
    return this._category === 'composition';
  }

  isAssociation(): boolean {
    return this._category === 'association';
  }

  isTemporal(): boolean {
    return this._category === 'temporal';
  }

  equals(other: RelationshipType): boolean {
    return this._type === other._type;
  }

  toString(): string {
    return this._type;
  }
}
