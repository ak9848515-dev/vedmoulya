// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace view derivation (integrity repair, 2026-10-26)
//
// Why this module exists: the Marketplace page used to render a hardcoded
// `INITIAL_ASSETS` array plus fixed stat values ("12 installed", "3 providers",
// "2 updates", "8 templates", "100%" compatible) while the real backend
// snapshot (`marketplace.getMarketplace`) was ignored. Install/uninstall only
// flipped React local state, so the screen could claim installs that were never
// persisted anywhere.
//
// Every value below is DERIVED from the real `MarketplaceSnapshotDTO` that the
// gateway returns. When the payload is missing or malformed the derivation
// reports `unavailable`; when it is genuinely empty it reports `empty`. Nothing
// here invents a count, a provider, a compatibility score or an update.
//
// The snapshot contract lives in
// `packages/services/src/marketplace/MarketplaceDTO.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketplaceAvailability = 'unavailable' | 'empty' | 'ready';

export type MarketplaceCompatibilityOverall = 'compatible' | 'partial' | 'incompatible' | 'unknown';

export interface MarketplaceAssetView {
  id: string;
  name: string;
  type: string;
  version: string;
  category: string;
  installed: boolean;
  active: boolean;
  /** True only when the gateway's `availableUpdates` lists this asset. */
  updateAvailable: boolean;
  /** Rating as reported by the catalog — `null` when the field is absent. */
  rating: number | null;
}

export interface MarketplaceProviderView {
  id: string;
  name: string;
  type: string;
  status: string;
  apiKeyConfigured: boolean;
}

export interface MarketplaceUpdateView {
  id: string;
  assetId: string;
  assetName: string;
  version: string;
  breaking: boolean;
}

export interface MarketplaceCompatibilityView {
  overall: MarketplaceCompatibilityOverall;
  platformVersion: string | null;
  passed: number;
  total: number;
  issues: string[];
  warnings: string[];
}

export interface MarketplaceCounts {
  installedAssets: number;
  providers: number;
  updates: number;
  catalogAssets: number;
  templates: number;
  compatibilityPassed: number;
  compatibilityTotal: number;
}

export interface MarketplaceView {
  availability: MarketplaceAvailability;
  /** Populated only for `unavailable` — the reason the payload could not be read. */
  unavailableReason: string | null;
  counts: MarketplaceCounts;
  assets: MarketplaceAssetView[];
  installedAssets: MarketplaceAssetView[];
  providers: MarketplaceProviderView[];
  updates: MarketplaceUpdateView[];
  compatibility: MarketplaceCompatibilityView;
}

// ── Install/uninstall capability ──────────────────────────────────────────
// The gateway router (`services/api/src/routers/MarketplaceRouter.ts`) exposes
// ONLY `getMarketplace`, `getViewModel`, `getConfig` and `invalidateCache`.
// There is no install/uninstall mutation and no persisted asset store behind
// `MarketplaceApplicationService` (its catalog/asset/provider maps are
// in-process and never seeded in production). A UI toggle therefore cannot be
// persisted, so the screen states the capability as unavailable instead of
// simulating success.
// Typed as `boolean` on purpose: the flag is a capability descriptor, not a
// literal the compiler may narrow, so the UI branch stays reviewable.
export const MARKETPLACE_INSTALL_AVAILABLE: boolean = false;

export const MARKETPLACE_INSTALL_UNAVAILABLE_REASON =
  'Install and uninstall are unavailable: the gateway exposes no marketplace install/uninstall mutation, so no change could be persisted.';

const EMPTY_COMPATIBILITY: MarketplaceCompatibilityView = {
  overall: 'unknown',
  platformVersion: null,
  passed: 0,
  total: 0,
  issues: [],
  warnings: [],
};

const EMPTY_COUNTS: MarketplaceCounts = {
  installedAssets: 0,
  providers: 0,
  updates: 0,
  catalogAssets: 0,
  templates: 0,
  compatibilityPassed: 0,
  compatibilityTotal: 0,
};

const TEMPLATE_TYPES = new Set([
  'workflow_template',
  'career_template',
  'learning_template',
  'business_template',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === 'string');
}

function toAssetView(raw: unknown): MarketplaceAssetView | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  // An asset without an id or a name cannot be rendered honestly.
  if (id.length === 0 || name.length === 0) return null;
  return {
    id,
    name,
    type: asString(raw.type, 'unknown'),
    version: asString(raw.version, '—'),
    category: asString(raw.category),
    installed: asBoolean(raw.isInstalled),
    active: asBoolean(raw.isActive),
    updateAvailable: false,
    rating: asNumber(raw.rating),
  };
}

function toProviderView(raw: unknown): MarketplaceProviderView | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (id.length === 0 || name.length === 0) return null;
  return {
    id,
    name,
    type: asString(raw.type, 'unknown'),
    status: asString(raw.status, 'unknown'),
    apiKeyConfigured: asBoolean(raw.apiKeyConfigured),
  };
}

function toUpdateView(raw: unknown): MarketplaceUpdateView | null {
  if (!isRecord(raw)) return null;
  const assetId = asString(raw.assetId);
  const assetName = asString(raw.assetName);
  if (assetId.length === 0) return null;
  return {
    id: asString(raw.id, `${assetId}:${asString(raw.version)}`),
    assetId,
    assetName: assetName.length > 0 ? assetName : assetId,
    version: asString(raw.version, '—'),
    breaking: asBoolean(raw.breaking),
  };
}

function toCompatibilityView(raw: unknown): MarketplaceCompatibilityView {
  if (!isRecord(raw)) return EMPTY_COMPATIBILITY;
  const overall = asString(raw.overall, 'unknown');
  const checks = asArray(raw.checks);
  const passed = checks.filter(
    (check) => isRecord(check) && asString(check.status) === 'passed',
  ).length;
  return {
    overall:
      overall === 'compatible' || overall === 'partial' || overall === 'incompatible'
        ? overall
        : 'unknown',
    platformVersion: typeof raw.platformVersion === 'string' ? raw.platformVersion : null,
    passed,
    total: checks.length,
    issues: asStringArray(raw.issues),
    warnings: asStringArray(raw.warnings),
  };
}

/** Catalog rows the backend published (featured / popular / recent) plus the
 *  user's installed assets. The snapshot has no single "all assets" list, so
 *  these are the authoritative subsets it does return — deduped by id. */
function collectAssets(snapshot: Record<string, unknown>): MarketplaceAssetView[] {
  const catalog = isRecord(snapshot.catalog) ? snapshot.catalog : {};
  const rawLists = [
    ...asArray(catalog.featured),
    ...asArray(catalog.popular),
    ...asArray(catalog.recent),
    ...asArray(snapshot.installedAssets),
  ];
  const byId = new Map<string, MarketplaceAssetView>();
  for (const raw of rawLists) {
    const view = toAssetView(raw);
    if (view && !byId.has(view.id)) byId.set(view.id, view);
  }
  return [...byId.values()];
}

/**
 * Derive the entire Marketplace screen model from the `marketplace.getMarketplace`
 * payload (`ApiResponse<MarketplaceSnapshotDTO>`).
 *
 * - `null`/`undefined` payload → `unavailable` (no snapshot was received).
 * - `success: false` envelope  → `unavailable` with the gateway's message.
 * - readable snapshot with no assets/providers/updates → `empty`.
 * - otherwise → `ready`.
 */
export function deriveMarketplaceView(payload: unknown): MarketplaceView {
  if (!isRecord(payload)) {
    return {
      availability: 'unavailable',
      unavailableReason: 'No marketplace snapshot was returned by the gateway.',
      counts: EMPTY_COUNTS,
      assets: [],
      installedAssets: [],
      providers: [],
      updates: [],
      compatibility: EMPTY_COMPATIBILITY,
    };
  }

  if (payload.success === false) {
    const error = isRecord(payload.error) ? payload.error : {};
    const message = asString(error.message) || asString(payload.error);
    return {
      availability: 'unavailable',
      unavailableReason: message.length > 0 ? message : 'The gateway rejected the request.',
      counts: EMPTY_COUNTS,
      assets: [],
      installedAssets: [],
      providers: [],
      updates: [],
      compatibility: EMPTY_COMPATIBILITY,
    };
  }

  const snapshot = isRecord(payload.data) ? payload.data : payload;

  const updates = asArray(snapshot.availableUpdates)
    .map(toUpdateView)
    .filter((update): update is MarketplaceUpdateView => update !== null);
  const updateIds = new Set(updates.map((update) => update.assetId));

  const assets = collectAssets(snapshot).map((asset) => ({
    ...asset,
    // Installed state is authoritative on the asset; update availability is
    // authoritative on `availableUpdates` — never inferred from a version bump.
    installed: asset.installed,
    updateAvailable: updateIds.has(asset.id),
  }));

  const installedAssets = assets.filter((asset) => asset.installed);
  const providers = asArray(snapshot.providers)
    .map(toProviderView)
    .filter((provider): provider is MarketplaceProviderView => provider !== null);
  const compatibility = toCompatibilityView(snapshot.compatibility);

  const templates = assets.filter((asset) => TEMPLATE_TYPES.has(asset.type)).length;

  const counts: MarketplaceCounts = {
    installedAssets: installedAssets.length,
    providers: providers.length,
    updates: updates.length,
    catalogAssets: assets.length,
    templates,
    compatibilityPassed: compatibility.passed,
    compatibilityTotal: compatibility.total,
  };

  const availability: MarketplaceAvailability =
    assets.length === 0 && providers.length === 0 && updates.length === 0 ? 'empty' : 'ready';

  return {
    availability,
    unavailableReason: null,
    counts,
    assets,
    installedAssets,
    providers,
    updates,
    compatibility,
  };
}

/** Honest compatibility label — never a fabricated percentage. */
export function compatibilityLabel(compatibility: MarketplaceCompatibilityView): string {
  if (compatibility.total === 0) return 'Not checked';
  switch (compatibility.overall) {
    case 'compatible':
      return 'Compatible';
    case 'partial':
      return 'Partially compatible';
    case 'incompatible':
      return 'Incompatible';
    default:
      return 'Unknown';
  }
}

/** Human-readable update badge text; returns `null` when nothing is pending. */
export function updatesBadgeText(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 update available' : `${String(count)} updates available`;
}
