// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionContext
// Situational factors that influence execution
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export interface ExecutionContextParams {
  energyLevel?: number; // 1–10
  timeAvailable?: number; // minutes
  location?: string;
  resources?: string[];
  interruptions?: string[];
  focusScore?: number; // 1–10
}

export class ExecutionContext {
  private readonly _energyLevel?: number;
  private readonly _timeAvailable?: number;
  private readonly _location?: string;
  private readonly _resources: string[];
  private readonly _interruptions: string[];
  private readonly _focusScore?: number;

  constructor(params: ExecutionContextParams = {}) {
    this._energyLevel = params.energyLevel;
    this._timeAvailable = params.timeAvailable;
    this._location = params.location;
    this._resources = params.resources ?? [];
    this._interruptions = params.interruptions ?? [];
    this._focusScore = params.focusScore;
  }

  static empty(): ExecutionContext {
    return new ExecutionContext();
  }

  get energyLevel(): number | undefined {
    return this._energyLevel;
  }
  get timeAvailable(): number | undefined {
    return this._timeAvailable;
  }
  get location(): string | undefined {
    return this._location;
  }
  get resources(): readonly string[] {
    return Object.freeze([...this._resources]);
  }
  get interruptions(): readonly string[] {
    return Object.freeze([...this._interruptions]);
  }
  get focusScore(): number | undefined {
    return this._focusScore;
  }

  get hasHighEnergy(): boolean {
    return (this._energyLevel ?? 5) >= 7;
  }
  get hasLowEnergy(): boolean {
    return (this._energyLevel ?? 5) <= 3;
  }
  get hasGoodFocus(): boolean {
    return (this._focusScore ?? 5) >= 7;
  }
  get hasTimePressure(): boolean {
    return (this._timeAvailable ?? 60) < 30;
  }

  toString(): string {
    const parts: string[] = [];
    if (this._energyLevel) parts.push(`energy:${String(this._energyLevel)}/10`);
    if (this._timeAvailable) parts.push(`time:${String(this._timeAvailable)}min`);
    if (this._location) parts.push(`at:${this._location}`);
    if (this._focusScore) parts.push(`focus:${String(this._focusScore)}/10`);
    return parts.join(', ');
  }
}
