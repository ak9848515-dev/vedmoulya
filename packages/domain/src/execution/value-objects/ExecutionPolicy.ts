// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionPolicy
// Policies that govern execution behavior and constraints
// ARC-004/D08 — Execution Policies
// ──────────────────────────────────────────────────────────────────

export type PolicyDomain =
  'scheduling' | 'capacity' | 'quality' | 'recovery' | 'adaptation' | 'general';
export type PolicySeverity = 'hard' | 'soft' | 'advisory';

export interface PolicyRule {
  condition: string;
  action: string;
  severity: PolicySeverity;
}

export class ExecutionPolicy {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _description: string;
  private readonly _domain: PolicyDomain;
  private readonly _rules: PolicyRule[];
  private readonly _isActive: boolean;

  constructor(params: {
    id: string;
    name: string;
    description: string;
    domain: PolicyDomain;
    rules: PolicyRule[];
    isActive?: boolean;
  }) {
    this._id = params.id;
    this._name = params.name;
    this._description = params.description;
    this._domain = params.domain;
    this._rules = params.rules;
    this._isActive = params.isActive ?? true;
  }

  static noBurnout(): ExecutionPolicy {
    return new ExecutionPolicy({
      id: 'policy_no_burnout',
      name: 'No Burnout',
      description: 'Prevents overwork by enforcing rest periods and capacity limits',
      domain: 'capacity',
      rules: [
        { condition: 'daily_work_hours > 8', action: 'schedule_rest', severity: 'hard' },
        { condition: 'consecutive_work_days > 6', action: 'force_rest_day', severity: 'hard' },
        { condition: 'weekly_hours > 40', action: 'reduce_next_week', severity: 'soft' },
      ],
    });
  }

  static sustainableGrowth(): ExecutionPolicy {
    return new ExecutionPolicy({
      id: 'policy_sustainable_growth',
      name: 'Sustainable Growth',
      description:
        'Ensures consistent progress without burnout by balancing challenge and capacity',
      domain: 'general',
      rules: [
        {
          condition: 'task_difficulty > energy_level',
          action: 'reschedule_easier_task',
          severity: 'soft',
        },
        { condition: 'streak > 5', action: 'reward_break', severity: 'advisory' },
        { condition: 'completion_rate < 0.3', action: 'reduce_weekly_load', severity: 'soft' },
      ],
    });
  }

  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get domain(): PolicyDomain {
    return this._domain;
  }
  get rules(): readonly PolicyRule[] {
    return Object.freeze([...this._rules]);
  }
  get isActive(): boolean {
    return this._isActive;
  }

  toString(): string {
    return `${this._name} [${this._domain}] (${String(this._rules.length)} rules)`;
  }

  equals(other: ExecutionPolicy): boolean {
    return this._id === other._id;
  }
}
