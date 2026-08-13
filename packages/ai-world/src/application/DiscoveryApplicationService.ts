// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryApplicationService
// EPIC-012C — the aiWorld.* contract implementation
//
// Owner-scoped at the service: every per-user read/write is keyed by
// the caller's own userId (never an arbitrary owner param) — the
// gateway IDOR guard and this service's own scoping both apply.
// ──────────────────────────────────────────────────────────────────

import type {
  AIWorldView,
  DiscoveryBudget,
  DiscoveryDigest,
  DiscoveryItem,
  DiscoveryItemAction,
  DiscoveryRunReport,
  DiscoveryUserState,
} from '../types/discovery-types.js';
import type { AIDiscoverySource } from '../contracts/AIDiscoverySource.js';
import type { DiscoveryStore } from '../domain/DiscoveryStore.js';
import { DiscoveryOrchestrator } from '../domain/DiscoveryOrchestrator.js';
import { DigestBuilder } from '../domain/DigestBuilder.js';
import { DEFAULT_DISCOVERY_BUDGET } from '../types/discovery-types.js';

export interface DiscoveryApplicationServiceOptions {
  sources?: AIDiscoverySource[];
  store: DiscoveryStore;
  budget?: DiscoveryBudget;
  now?: () => Date;
  vedMoulyaCapabilities?: string[];
  /** Seed the store from sources on first access (bounded run). */
  autoSeed?: boolean;
}

/** Item + the caller's own attention state (owner-scoped). */
export interface DiscoveryItemView {
  item: DiscoveryItem;
  read: boolean;
  action: DiscoveryItemAction;
}

export interface DiscoveryWorldResult {
  world: AIWorldView;
  lastRunAt?: string;
  /** When the next refresh becomes available (refresh policy). */
  runAvailableAt?: string;
}

export class DiscoveryApplicationService {
  private readonly sources: AIDiscoverySource[];
  private readonly store: DiscoveryStore;
  private readonly budget: DiscoveryBudget;
  private readonly now: () => Date;
  private readonly orchestrator: DiscoveryOrchestrator;
  private readonly digestBuilder: DigestBuilder;
  private readonly autoSeed: boolean;
  private lastRunAt?: string;
  private seeded = false;

  constructor(options: DiscoveryApplicationServiceOptions) {
    this.sources = options.sources ?? [];
    this.store = options.store;
    this.budget = options.budget ?? DEFAULT_DISCOVERY_BUDGET;
    this.now = options.now ?? ((): Date => new Date());
    this.orchestrator = new DiscoveryOrchestrator({
      now: this.now,
      vedMoulyaCapabilities: options.vedMoulyaCapabilities,
    });
    this.digestBuilder = new DigestBuilder();
    this.autoSeed = options.autoSeed ?? true;
  }

  // ── World view (the bell) ───────────────────────────────────────────

  async getWorld(userId: string): Promise<DiscoveryWorldResult> {
    await this.ensureSeeded();
    const items = await this.store.listItems();
    const views = await this.withUserState(userId, items);

    const important = views.filter((v) => {
      const { item, action } = v.view;
      return (
        action !== 'dismissed' &&
        item.recommendation !== 'IGNORE' &&
        (item.recommendation === 'CONFIGURE' ||
          item.recommendation === 'INTEGRATE' ||
          item.recommendation === 'TRY') &&
        item.relevanceLabel === 'high'
      );
    });
    const recommended = views.filter((v) => {
      const { item, action } = v.view;
      return (
        action !== 'dismissed' &&
        item.recommendation !== 'IGNORE' &&
        (item.recommendation === 'REVIEW' || item.recommendation === 'WATCH') &&
        item.relevanceLabel !== 'low'
      );
    });
    const github = views.filter((v) => {
      const { item, action } = v.view;
      return (
        action !== 'dismissed' && item.category === 'github' && item.recommendation !== 'IGNORE'
      );
    });
    const updates = views.filter((v) => {
      const { item, action } = v.view;
      return action !== 'dismissed' && item.category === 'news' && item.recommendation !== 'IGNORE';
    });

    const unreadCount = views.filter((v) => !v.view.read && v.view.action !== 'dismissed').length;

    return {
      world: {
        generatedAt: this.now().toISOString(),
        important: important.map((v) => v.view.item),
        recommended: recommended.map((v) => v.view.item),
        github: github.map((v) => v.view.item),
        updates: updates.map((v) => v.view.item),
        unreadCount,
      },
      lastRunAt: this.lastRunAt,
      runAvailableAt: this.runAvailableAt(),
    };
  }

  // ── Digest ──────────────────────────────────────────────────────────

  async getDigest(userId: string): Promise<DiscoveryDigest> {
    await this.ensureSeeded();
    const items = await this.store.listItems();
    const views = await this.withUserState(userId, items);
    const visible = views.filter((v) => v.view.action !== 'dismissed').map((v) => v.view.item);
    return this.digestBuilder.build(visible, { date: this.now().toISOString().slice(0, 10) });
  }

  // ── Listing ─────────────────────────────────────────────────────────

  async listItems(userId: string): Promise<DiscoveryItemView[]> {
    await this.ensureSeeded();
    const items = await this.store.listItems();
    const views = await this.withUserState(userId, items);
    return views.map((v) => v.view);
  }

  async getItem(userId: string, itemId: string): Promise<DiscoveryItemView | undefined> {
    const item = await this.store.getItem(itemId);
    if (!item) return undefined;
    const state = await this.store.getUserState(userId, itemId);
    return { item, ...state };
  }

  // ── Owner-scoped actions ────────────────────────────────────────────

  async markRead(userId: string, itemId: string): Promise<void> {
    await this.store.markRead(userId, itemId);
  }

  async setAction(userId: string, itemId: string, action: DiscoveryItemAction): Promise<void> {
    await this.store.setAction(userId, itemId, action);
  }

  // ── Bounded refresh ─────────────────────────────────────────────────

  /**
   * Explicit, bounded re-discovery. Enforces the refresh interval
   * (rate-limit respect); returns an honest report.
   */
  async runDiscovery(): Promise<DiscoveryRunReport> {
    const nextAvailable = this.runAvailableAt();
    if (nextAvailable && nextAvailable > this.now().toISOString()) {
      // Rate-limit: skip the run and report honestly.
      return {
        ranAt: this.now().toISOString(),
        sources: [],
        totalAdded: 0,
        budget: this.budget,
      };
    }
    const report = await this.orchestrator.run(this.sources, this.store, this.budget);
    this.lastRunAt = report.ranAt;
    return report;
  }

  // ── EPIC-018 scheduled-discovery seams ────────────────────────────
  // The scheduler decides WHEN; it drives the SAME bounded orchestrator,
  // store and sources — never a second discovery database. The scheduler
  // enforces its own policies/cooldowns/rate limits; these seams only
  // execute discovery (budgets/security/dedup stay inside the orchestrator).

  /**
   * Bounded scheduled discovery restricted to the given source ids. Returns
   * the honest run report (per-source outcomes); items land in the SAME
   * existing DiscoveryStore. Live/refresh-rate gating is the scheduler's job.
   */
  async runScheduledDiscovery(opts: {
    sourceIds?: string[];
    budget?: DiscoveryBudget;
  }): Promise<DiscoveryRunReport> {
    const sourceIds = opts.sourceIds;
    const sources =
      sourceIds === undefined ? this.sources : this.sources.filter((s) => sourceIds.includes(s.id));
    const report = await this.orchestrator.run(sources, this.store, opts.budget ?? this.budget);
    this.lastRunAt = report.ranAt;
    return report;
  }

  /** Raw item listing for scheduler change detection (no per-user state). */
  async listRawItems(): Promise<DiscoveryItem[]> {
    return this.store.listItems();
  }

  /** The configured discovery source ids (for per-source policy gates). */
  getSourceIds(): string[] {
    return this.sources.map((s) => s.id);
  }

  // ── Internals ───────────────────────────────────────────────────────

  private async ensureSeeded(): Promise<void> {
    if (this.seeded || !this.autoSeed || this.sources.length === 0) return;
    const items = await this.store.listItems();
    if (items.length > 0) {
      this.seeded = true;
      return;
    }
    const report = await this.orchestrator.run(this.sources, this.store, this.budget);
    this.lastRunAt = report.ranAt;
    this.seeded = true;
  }

  private async withUserState(
    userId: string,
    items: DiscoveryItem[],
  ): Promise<Array<{ view: DiscoveryItemView; read: boolean; action: DiscoveryItemAction }>> {
    const result: Array<{ view: DiscoveryItemView; read: boolean; action: DiscoveryItemAction }> =
      [];
    for (const item of items) {
      const state: DiscoveryUserState = await this.store.getUserState(userId, item.id);
      result.push({
        view: { item, read: state.read, action: state.action },
        read: state.read,
        action: state.action,
      });
    }
    return result;
  }

  private runAvailableAt(): string | undefined {
    if (!this.lastRunAt) return undefined;
    const next = Date.parse(this.lastRunAt) + this.budget.minRefreshIntervalMs;
    return new Date(next).toISOString();
  }
}
