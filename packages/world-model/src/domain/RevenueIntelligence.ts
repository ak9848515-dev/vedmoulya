// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · RevenueIntelligence
// SPRINT-033 (Part F) — revenue intelligence for the founder.
//
// NOT an engine and NOT a promise: every figure is VERIFIED / ESTIMATED /
// UNKNOWN only, and a figure without evidence contributes NOTHING to any
// composite. Margins and ROI are ADVISORY numbers computed from evidence —
// never invented. The decision hints (BUILD / BUY / AUTOMATE / OUTSOURCE /
// STOP / SCALE) are advisory labels with reasons; the founder decides and
// nothing here spends or commits. Costs stay authoritative in CostLedger;
// this model only REPRESENTS evidence about a stream.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ObservationStatus,
  RevenueDecisionHint,
  RevenueFigure,
  RevenueSnapshot,
  RevenueStream,
  RevenueStreamKind,
  RevenueStreamStatus,
} from '../types/world-types.js';

export type RevenueResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): RevenueResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code: string): RevenueResult<T> {
  return { success: false, error, code };
}

export interface RevenueStreamStoreLike {
  save(stream: RevenueStream): void;
  get(ownerId: string, id: string): RevenueStream | undefined;
  getByKey(ownerId: string, stableKey: string): RevenueStream | undefined;
  list(ownerId: string): RevenueStream[];
  remove(ownerId: string, id: string): void;
}

const MAX_STREAMS_PER_OWNER = 25;
const MAX_FIGURE_EVIDENCE = 4;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function clampFigure(figure: RevenueFigure | undefined): RevenueFigure | undefined {
  if (!figure) return undefined;
  return {
    value: figure.value,
    status: figure.status,
    evidence: figure.evidence.slice(0, MAX_FIGURE_EVIDENCE),
  };
}

export class RevenueIntelligence {
  private readonly streams: RevenueStreamStoreLike;
  private readonly now: () => string;

  constructor(streams: RevenueStreamStoreLike, now?: () => string) {
    this.streams = streams;
    this.now = now ?? ((): string => new Date().toISOString());
  }

  /** Register/upsert a revenue stream (stable-key idempotent, owner-scoped,
   *  bounded per owner). Figures are evidence-carrying — a figure with no
   *  evidence is refused. */
  register(input: {
    ownerId: string;
    id?: string;
    name: string;
    kind: RevenueStreamKind;
    status?: RevenueStreamStatus;
    businessUnitId?: string;
    estimatedMonthlyRevenueUsd?: RevenueFigure;
    actualMonthlyRevenueUsd?: RevenueFigure;
    estimatedMonthlyCostUsd?: RevenueFigure;
    actualMonthlyCostUsd?: RevenueFigure;
    automationPercentage?: RevenueFigure;
    humanEffortHoursMonthly?: RevenueFigure;
    customerCount?: RevenueFigure;
    conversionRate?: RevenueFigure;
    retentionRate?: RevenueFigure;
    note?: string;
  }): RevenueResult<RevenueStream> {
    const name = input.name.trim();
    if (name.length === 0) return err('A revenue stream needs a name.', 'INVALID_NAME');
    if (name.length > 120) return err('Revenue stream name is too long.', 'INVALID_NAME');
    if (input.kind.length === 0) return err('A revenue stream needs a kind.', 'INVALID_KIND');
    // A figure without evidence is refused — no fabricated numbers.
    const figures = [
      input.estimatedMonthlyRevenueUsd,
      input.actualMonthlyRevenueUsd,
      input.estimatedMonthlyCostUsd,
      input.actualMonthlyCostUsd,
      input.automationPercentage,
      input.humanEffortHoursMonthly,
      input.customerCount,
      input.conversionRate,
      input.retentionRate,
    ].filter((f): f is RevenueFigure => f !== undefined);
    for (const figure of figures) {
      if (figure.evidence.length === 0) {
        return err(
          'Every revenue figure requires evidence — nothing is fabricated.',
          'NO_EVIDENCE',
        );
      }
      if (figure.status === 'UNKNOWN') {
        return err(
          'An UNKNOWN figure is not recorded — leave the field unset instead.',
          'UNKNOWN_FIGURE',
        );
      }
    }
    if (input.automationPercentage !== undefined) {
      const auto = input.automationPercentage;
      if (auto.value < 0 || auto.value > 1) {
        return err('Automation percentage must be 0..1.', 'INVALID_RANGE');
      }
    }
    if (
      input.conversionRate !== undefined &&
      (input.conversionRate.value < 0 || input.conversionRate.value > 1)
    ) {
      return err('Conversion rate must be 0..1.', 'INVALID_RANGE');
    }
    if (
      input.retentionRate !== undefined &&
      (input.retentionRate.value < 0 || input.retentionRate.value > 1)
    ) {
      return err('Retention rate must be 0..1.', 'INVALID_RANGE');
    }
    const ts = this.now();
    const stableKey = `${input.ownerId}:revenue:${slug(name)}`;
    const existing = this.streams.getByKey(input.ownerId, stableKey);
    const stream: RevenueStream = {
      id: existing?.id ?? input.id ?? `rs-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      stableKey,
      businessUnitId: input.businessUnitId?.slice(0, 120),
      name,
      kind: input.kind,
      status: input.status ?? existing?.status ?? 'ACTIVE',
      estimatedMonthlyRevenueUsd: clampFigure(input.estimatedMonthlyRevenueUsd),
      actualMonthlyRevenueUsd: clampFigure(input.actualMonthlyRevenueUsd),
      estimatedMonthlyCostUsd: clampFigure(input.estimatedMonthlyCostUsd),
      actualMonthlyCostUsd: clampFigure(input.actualMonthlyCostUsd),
      automationPercentage: clampFigure(input.automationPercentage),
      humanEffortHoursMonthly: clampFigure(input.humanEffortHoursMonthly),
      customerCount: clampFigure(input.customerCount),
      conversionRate: clampFigure(input.conversionRate),
      retentionRate: clampFigure(input.retentionRate),
      note: input.note?.slice(0, 400),
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    this.streams.save(stream);
    this.bound(stream.ownerId);
    return ok(stream);
  }

  list(ownerId: string): RevenueStream[] {
    return this.streams.list(ownerId);
  }

  remove(ownerId: string, id: string): RevenueResult<{ removed: boolean }> {
    const existing = this.streams.get(ownerId, id);
    if (!existing) return err('Revenue stream not found.', 'NOT_FOUND');
    this.streams.remove(ownerId, id);
    return ok({ removed: true });
  }

  /** Advisory snapshot — figures only from evidence. Nothing is summed from
   *  UNKNOWN, margins only when revenue AND cost are evidence-backed. */
  snapshot(ownerId: string): RevenueSnapshot {
    const streams = this.streams.list(ownerId);
    const active = streams.filter((s) => s.status === 'ACTIVE');
    const sum = (fig?: RevenueFigure): number | undefined =>
      fig === undefined ? undefined : fig.value;

    const estimatedRevenueValues = active
      .map((s) => s.estimatedMonthlyRevenueUsd)
      .filter((f): f is RevenueFigure => f !== undefined);
    const actualRevenueValues = active
      .map((s) => s.actualMonthlyRevenueUsd)
      .filter((f): f is RevenueFigure => f !== undefined);
    const estimatedCostValues = active
      .map((s) => s.estimatedMonthlyCostUsd)
      .filter((f): f is RevenueFigure => f !== undefined);
    const actualCostValues = active
      .map((s) => s.actualMonthlyCostUsd)
      .filter((f): f is RevenueFigure => f !== undefined);

    const totalEstimatedRevenue =
      estimatedRevenueValues.length > 0
        ? estimatedRevenueValues.reduce((acc, f) => acc + f.value, 0)
        : undefined;
    const totalActualRevenue =
      actualRevenueValues.length > 0
        ? actualRevenueValues.reduce((acc, f) => acc + f.value, 0)
        : undefined;
    const totalEstimatedCost =
      estimatedCostValues.length > 0
        ? estimatedCostValues.reduce((acc, f) => acc + f.value, 0)
        : undefined;
    const totalActualCost =
      actualCostValues.length > 0
        ? actualCostValues.reduce((acc, f) => acc + f.value, 0)
        : undefined;

    const margin = (revenue: number, cost: number): number | undefined =>
      revenue > 0 ? Math.max(0, Math.min(1, (revenue - cost) / revenue)) : undefined;

    const automationValues = active
      .map((s) => s.automationPercentage)
      .filter((f): f is RevenueFigure => f !== undefined);
    const averageAutomation =
      automationValues.length > 0
        ? automationValues.reduce((acc, f) => acc + f.value, 0) / automationValues.length
        : undefined;

    const effortValues = active
      .map((s) => s.humanEffortHoursMonthly)
      .filter((f): f is RevenueFigure => f !== undefined);
    const totalEffort =
      effortValues.length > 0 ? effortValues.reduce((acc, f) => acc + f.value, 0) : undefined;

    return {
      ownerId,
      generatedAt: this.now(),
      streamCount: streams.length,
      activeStreamCount: active.length,
      totalEstimatedMonthlyRevenueUsd: totalEstimatedRevenue,
      totalActualMonthlyRevenueUsd: totalActualRevenue,
      totalEstimatedMonthlyCostUsd: totalEstimatedCost,
      totalActualMonthlyCostUsd: totalActualCost,
      estimatedMargin:
        totalEstimatedRevenue !== undefined && totalEstimatedCost !== undefined
          ? margin(totalEstimatedRevenue, totalEstimatedCost)
          : undefined,
      actualMargin:
        totalActualRevenue !== undefined && totalActualCost !== undefined
          ? margin(totalActualRevenue, totalActualCost)
          : undefined,
      averageAutomationPercentage: averageAutomation,
      totalHumanEffortHoursMonthly: totalEffort,
      streams: active.slice(0, 10).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        status: s.status,
        estimatedMonthlyRevenueUsd: sum(s.estimatedMonthlyRevenueUsd),
        actualMonthlyRevenueUsd: sum(s.actualMonthlyRevenueUsd),
        estimatedMargin:
          s.estimatedMonthlyRevenueUsd && s.estimatedMonthlyCostUsd
            ? margin(s.estimatedMonthlyRevenueUsd.value, s.estimatedMonthlyCostUsd.value)
            : undefined,
        automationPercentage: s.automationPercentage?.value,
      })),
      advisory: true,
    };
  }

  /** Advisory decision hints — every hint is evidence-derived; UNKNOWN when no
   *  evidence supports a direction (honest default). Never a promise. */
  decide(ownerId: string): RevenueDecisionHint[] {
    return this.streams.list(ownerId).map((stream) => {
      const revenue = stream.actualMonthlyRevenueUsd ?? stream.estimatedMonthlyRevenueUsd;
      const cost = stream.actualMonthlyCostUsd ?? stream.estimatedMonthlyCostUsd;
      const automation = stream.automationPercentage;
      const effort = stream.humanEffortHoursMonthly;
      const retention = stream.retentionRate;
      const reasons: string[] = [];

      if (!revenue && !cost) {
        return {
          streamId: stream.id,
          streamName: stream.name,
          hint: 'UNKNOWN',
          reasons: ['No revenue or cost evidence yet — no decision hint is justified.'],
          advisory: true,
        };
      }

      if (revenue && cost) {
        const marginValue = revenue.value > 0 ? (revenue.value - cost.value) / revenue.value : -1;
        reasons.push(
          `Advisory margin ${(marginValue * 100).toFixed(0)}% from evidence (revenue ${revenue.status}, cost ${cost.status}).`,
        );
        if (marginValue < 0) {
          reasons.push('Revenue does not cover cost at current evidence.');
        }
      }

      if (automation) {
        reasons.push(
          automation.value >= 0.7
            ? `High automation (${Math.round(automation.value * 100)}%) — the stream already runs mostly by itself.`
            : `Automation is ${Math.round(automation.value * 100)}% — remaining steps are human effort.`,
        );
      }
      if (effort && effort.value > 40) {
        reasons.push(
          `High human effort (${effort.value} h/month) — a candidate for further automation.`,
        );
      }
      if (retention) {
        reasons.push(`Retention ${Math.round(retention.value * 100)}% (evidence).`);
      }

      let hint: RevenueDecisionHint['hint'];
      const negativeMargin =
        revenue !== undefined &&
        cost !== undefined &&
        revenue.value > 0 &&
        revenue.value <= cost.value;
      if (negativeMargin) {
        hint = 'STOP';
        reasons.push('Advisory: STOP or restructure — current evidence shows cost ≥ revenue.');
      } else if (automation && automation.value >= 0.7 && revenue && revenue.value > 0) {
        hint = 'SCALE';
        reasons.push('Advisory: SCALE — positive revenue with high automation suggests leverage.');
      } else if (automation && automation.value < 0.5 && revenue && revenue.value > 0) {
        hint = 'AUTOMATE';
        reasons.push('Advisory: AUTOMATE — revenue exists and automation is below half.');
      } else {
        hint = 'UNKNOWN';
        reasons.push('No advisory direction is justified by the current evidence.');
      }
      return { streamId: stream.id, streamName: stream.name, hint, reasons, advisory: true };
    });
  }

  private bound(ownerId: string): void {
    const owned = this.streams.list(ownerId);
    if (owned.length <= MAX_STREAMS_PER_OWNER) return;
    const sorted = [...owned].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
    for (const evicted of sorted.slice(0, owned.length - MAX_STREAMS_PER_OWNER)) {
      this.streams.remove(ownerId, evicted.id);
    }
  }
}

/** Status-literal helper for callers (keeps the ObservationStatus discipline). */
export function evidenceStatus(value: 'VERIFIED' | 'ESTIMATED'): ObservationStatus {
  return value;
}
