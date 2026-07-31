// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionDependency
// Defines dependency relationships between execution entities
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export type DependencyType =
  'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface DependencyTarget {
  entityId: string;
  entityType: 'plan' | 'mission' | 'task' | 'step';
}

export class ExecutionDependency {
  private readonly _id: string;
  private readonly _sourceId: string;
  private readonly _targetId: string;
  private readonly _type: DependencyType;
  private readonly _description: string;
  private readonly _isHard: boolean; // hard = blocking, soft = preference

  constructor(
    id: string,
    sourceId: string,
    targetId: string,
    type: DependencyType,
    description: string,
    isHard: boolean = true,
  ) {
    this._id = id;
    this._sourceId = sourceId;
    this._targetId = targetId;
    this._type = type;
    this._description = description;
    this._isHard = isHard;
  }

  static finishToStart(
    sourceId: string,
    targetId: string,
    description: string,
    isHard?: boolean,
  ): ExecutionDependency {
    return new ExecutionDependency(
      `dep_${crypto.randomUUID().slice(0, 8)}`,
      sourceId,
      targetId,
      'finish_to_start',
      description,
      isHard,
    );
  }

  static startToStart(
    sourceId: string,
    targetId: string,
    description: string,
    isHard?: boolean,
  ): ExecutionDependency {
    return new ExecutionDependency(
      `dep_${crypto.randomUUID().slice(0, 8)}`,
      sourceId,
      targetId,
      'start_to_start',
      description,
      isHard,
    );
  }

  get id(): string {
    return this._id;
  }
  get sourceId(): string {
    return this._sourceId;
  }
  get targetId(): string {
    return this._targetId;
  }
  get type(): DependencyType {
    return this._type;
  }
  get description(): string {
    return this._description;
  }
  get isHard(): boolean {
    return this._isHard;
  }

  toString(): string {
    return `${this._type}: ${this._sourceId} → ${this._targetId}${this._isHard ? ' (hard)' : ' (soft)'}`;
  }

  equals(other: ExecutionDependency): boolean {
    return this._id === other._id;
  }
}
