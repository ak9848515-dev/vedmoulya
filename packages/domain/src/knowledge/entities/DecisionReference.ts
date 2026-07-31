// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: DecisionReference
// ARC-003 — A decision made by the User, with context and outcomes
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type DecisionOutcome = 'success' | 'failure' | 'mixed' | 'pending' | 'unknown';

export interface DecisionOption {
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  wasChosen: boolean;
}

/**
 * DecisionReference entity — records a decision made by the User,
 * including the context, options considered, and outcomes.
 */
export class DecisionReference {
  private readonly _node: KnowledgeNode;
  private _outcome: DecisionOutcome;
  private _options: DecisionOption[];
  private readonly _decisionDate: Date;

  constructor(
    node: KnowledgeNode,
    outcome?: DecisionOutcome,
    options?: DecisionOption[],
    decisionDate?: Date,
  ) {
    this._node = node;
    this._outcome = outcome ?? 'unknown';
    this._options = options ?? [];
    this._decisionDate = decisionDate ?? new Date();
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
  get outcome(): DecisionOutcome {
    return this._outcome;
  }
  get options(): readonly DecisionOption[] {
    return Object.freeze([...this._options]);
  }
  get decisionDate(): Date {
    return this._decisionDate;
  }

  /** Record the decision outcome */
  recordOutcome(outcome: DecisionOutcome): void {
    this._outcome = outcome;
  }

  /** Add an option that was considered */
  addOption(option: DecisionOption): void {
    this._options.push(option);
  }

  /** Mark the chosen option */
  chooseOption(label: string): void {
    this._options = this._options.map((o) => ({
      ...o,
      wasChosen: o.label === label,
    }));
  }

  /** Get the chosen option */
  getChosenOption(): DecisionOption | undefined {
    return this._options.find((o) => o.wasChosen);
  }

  /** Create a new DecisionReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    outcome?: DecisionOutcome;
    options?: DecisionOption[];
    decisionDate?: Date;
  }): DecisionReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.decision(),
      label: props.label,
      description: props.description,
    });
    return new DecisionReference(node, props.outcome, props.options, props.decisionDate);
  }
}
