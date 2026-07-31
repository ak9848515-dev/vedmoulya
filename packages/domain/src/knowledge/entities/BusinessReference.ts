// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: BusinessReference
// ARC-003 — A business entity or financial event in the user's life
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type BusinessEntityType =
  'client' | 'service' | 'product' | 'partnership' | 'vendor' | 'income' | 'expense';

export interface FinancialRecord {
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: Date;
  category: string;
  description?: string;
}

/**
 * BusinessReference entity — a business entity or financial event
 * in the User's professional and financial life.
 */
export class BusinessReference {
  private readonly _node: KnowledgeNode;
  private readonly _entityType: BusinessEntityType;
  private readonly _financialRecords: FinancialRecord[];

  constructor(
    node: KnowledgeNode,
    entityType: BusinessEntityType,
    financialRecords?: FinancialRecord[],
  ) {
    this._node = node;
    this._entityType = entityType;
    this._financialRecords = financialRecords ?? [];
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
  get entityType(): BusinessEntityType {
    return this._entityType;
  }
  get financialRecords(): readonly FinancialRecord[] {
    return Object.freeze([...this._financialRecords]);
  }

  /** Add a financial record */
  addFinancialRecord(record: FinancialRecord): void {
    this._financialRecords.push(record);
  }

  /** Calculate total income */
  getTotalIncome(): number {
    return this._financialRecords
      .filter((r) => r.type === 'income')
      .reduce((sum, r) => sum + r.amount, 0);
  }

  /** Calculate total expenses */
  getTotalExpenses(): number {
    return this._financialRecords
      .filter((r) => r.type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0);
  }

  /** Calculate net profit */
  getNetProfit(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  /** Create a new BusinessReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    entityType: BusinessEntityType;
    financialRecords?: FinancialRecord[];
  }): BusinessReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.business(),
      label: props.label,
      description: props.description,
    });
    return new BusinessReference(node, props.entityType, props.financialRecords);
  }
}
