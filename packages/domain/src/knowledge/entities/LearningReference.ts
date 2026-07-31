// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: LearningReference
// ARC-003 — A learning activity or educational experience
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type LearningType =
  | 'course'
  | 'book'
  | 'article'
  | 'video'
  | 'podcast'
  | 'workshop'
  | 'mentorship'
  | 'self_study'
  | 'certification'
  | 'degree';

export interface LearningProgress {
  /** Percentage completed (0-100) */
  percentage: number;
  /** Time spent in hours */
  hoursSpent: number;
  /** Key takeaways */
  takeaways: string[];
}

/**
 * LearningReference entity — a learning activity or educational experience.
 * Links to skills gained, knowledge acquired, and evidence of completion.
 */
export class LearningReference {
  private readonly _node: KnowledgeNode;
  private readonly _learningType: LearningType;
  private readonly _provider?: string;
  private _progress: LearningProgress;
  private _completed: boolean;

  constructor(
    node: KnowledgeNode,
    learningType: LearningType,
    provider?: string,
    progress?: Partial<LearningProgress>,
    completed?: boolean,
  ) {
    this._node = node;
    this._learningType = learningType;
    this._provider = provider;
    this._progress = {
      percentage: progress?.percentage ?? 0,
      hoursSpent: progress?.hoursSpent ?? 0,
      takeaways: progress?.takeaways ?? [],
    };
    this._completed = completed ?? false;
  }

  get node(): KnowledgeNode {
    return this._node;
  }
  get id(): KnowledgeNodeId {
    return this._node.id;
  }
  get graphId(): GraphId {
    return this._node.graphId;
  }
  get name(): string {
    return this._node.label;
  }
  get learningType(): LearningType {
    return this._learningType;
  }
  get provider(): string | undefined {
    return this._provider;
  }
  get progress(): LearningProgress {
    return this._progress;
  }
  get isCompleted(): boolean {
    return this._completed;
  }

  /** Update learning progress */
  updateProgress(progress: Partial<LearningProgress>): void {
    this._progress = {
      ...this._progress,
      ...progress,
      takeaways: progress.takeaways ?? this._progress.takeaways,
    };
  }

  /** Mark as completed */
  complete(): void {
    this._completed = true;
    this._progress.percentage = 100;
  }

  /** Add a takeaway */
  addTakeaway(takeaway: string): void {
    if (!this._progress.takeaways.includes(takeaway)) {
      this._progress.takeaways.push(takeaway);
    }
  }

  /** Create a new LearningReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    learningType: LearningType;
    provider?: string;
    progress?: Partial<LearningProgress>;
    completed?: boolean;
  }): LearningReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.learning(),
      label: props.label,
      description: props.description,
    });
    return new LearningReference(
      node,
      props.learningType,
      props.provider,
      props.progress,
      props.completed,
    );
  }
}
