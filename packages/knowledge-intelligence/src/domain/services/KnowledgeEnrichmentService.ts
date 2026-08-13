// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Enrichment Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Integrates the Knowledge Layer with every Enterprise Intelligence
// Engine (EI-001…EI-008) through narrow ports — no duplicated logic.
// Two jobs:
//   1. REGISTER WHO USES IT: every engine that responds to its port is
//      recorded as a `KnowledgeConsumer` on the item, so VedMoulya
//      always knows which engines rely on which knowledge.
//   2. CROSS-LINK WHAT IT DESCRIBES: when the item's text mentions a
//      live engine entity (a capability, provider, or goal) AND the
//      registry already holds a knowledge item documenting that
//      entity, a `uses` edge connects the two — building the graph
//      from the engines' own catalogs.
// Engine failures degrade gracefully — enrichment never fails the item.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeEngines } from '../../contracts/knowledge-engines.js';
import type {
  KnowledgeConsumer,
  KnowledgeItem,
  KnowledgeRelationship,
} from '../../types/knowledge-types.js';
import { generateConsumerId, generateRelationshipId } from '../value-objects/KnowledgeId.js';

export interface EnrichmentResult {
  item: KnowledgeItem;
  /** New `uses` edges to registry items that document the mentioned entities. */
  relationships: KnowledgeRelationship[];
  /** Consumers registered/updated on the item. */
  consumers: KnowledgeConsumer[];
  /** Engine consultation errors tolerated. */
  errors: string[];
}

/** Knowledge items whose title/tags document a given engine entity label. */
function documentingItems(label: string, registry: readonly KnowledgeItem[]): KnowledgeItem[] {
  const lower = label.toLowerCase();
  return registry.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) ||
      item.tags.some((tag) => tag.toLowerCase() === lower || tag.toLowerCase().includes(lower)),
  );
}

function mentions(searchable: string, label: string): boolean {
  return label.length >= 3 && searchable.toLowerCase().includes(label.toLowerCase());
}

export class KnowledgeEnrichmentService {
  /**
   * Enrich an item against the live engine registries and the current
   * registry contents (used to resolve engine entities → knowledge items).
   */
  async enrich(
    item: KnowledgeItem,
    engines: KnowledgeEngines,
    registry: readonly KnowledgeItem[],
  ): Promise<EnrichmentResult> {
    const errors: string[] = [];
    const relationships: KnowledgeRelationship[] = [];
    const consumers: KnowledgeConsumer[] = [...item.consumers];
    const now = new Date().toISOString();
    const searchable = `${item.title} ${item.description} ${item.tags.join(' ')} ${item.source}`;
    const knownIds = new Set(registry.map((r) => r.knowledgeId));

    const linkTo = (target: KnowledgeItem, actor: string, note: string): void => {
      if (target.knowledgeId === item.knowledgeId) return;
      if (relationships.some((r) => r.targetId === target.knowledgeId)) return;
      if (item.relationships.some((r) => r.targetId === target.knowledgeId && r.type === 'uses'))
        return;
      relationships.push({
        relationshipId: generateRelationshipId(),
        type: 'uses',
        sourceId: item.knowledgeId,
        sourceTitle: item.title,
        targetId: target.knowledgeId,
        targetTitle: target.title,
        weight: 0.8,
        actor,
        note,
        createdAt: now,
      });
    };

    const consume = (consumerId: string, consumerLabel: string): void => {
      const existing = consumers.find((c) => c.consumerId === consumerId);
      if (existing) {
        existing.usageCount += 1;
        existing.lastUsedAt = now;
      } else {
        consumers.push({
          consumerId,
          consumerType: 'engine',
          consumerLabel,
          usageCount: 1,
          firstUsedAt: now,
          lastUsedAt: now,
        });
      }
    };

    // EI-001 — Capability Registry: cross-link items documenting a capability.
    try {
      const marketplace = await engines.capabilities.getMarketplace();
      if (marketplace.success && marketplace.data) {
        for (const capability of marketplace.data.capabilities) {
          if (mentions(searchable, capability.name)) {
            for (const target of documentingItems(capability.name, registry)) {
              linkTo(target, 'capability-registry', 'Documents a live capability (EI-001)');
            }
          }
        }
      } else {
        errors.push(`capabilities.getMarketplace: ${marketplace.error ?? 'no data'}`);
      }
    } catch (error) {
      errors.push(
        `capabilities.getMarketplace: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // EI-002 — Provider Registry: cross-link items documenting a provider.
    try {
      const marketplace = await engines.providers.getMarketplace();
      if (marketplace.success && marketplace.data) {
        for (const provider of marketplace.data.providers) {
          if (mentions(searchable, provider.name)) {
            for (const target of documentingItems(provider.name, registry)) {
              linkTo(target, 'provider-registry', 'Documents a live provider (EI-002)');
            }
          }
        }
      } else {
        errors.push(`providers.getMarketplace: ${marketplace.error ?? 'no data'}`);
      }
    } catch (error) {
      errors.push(
        `providers.getMarketplace: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // EI-006 — Goal Engine: the Goal Engine consults knowledge for
    // classification/understanding, so it registers as a consumer.
    try {
      const summary = await engines.goals.getSummary();
      if (summary.success && summary.data) consume('goals', 'Goal & Task Intelligence (EI-006)');
      else errors.push(`goals.getSummary: ${summary.error ?? 'no data'}`);
    } catch (error) {
      errors.push(`goals.getSummary: ${error instanceof Error ? error.message : String(error)}`);
    }

    // EI-007 / EI-008 — the Learning platform and the Brain consume knowledge
    // as evidence for their models and decisions.
    // (The capabilities/providers cross-links above resolve against the
    // registry only when a knowledge item documents the entity.)
    try {
      const dashboard = await engines.learning.getDashboard();
      if (dashboard.success && dashboard.data)
        consume('learning-intelligence', 'Learning Intelligence (EI-007)');
      else errors.push(`learning.getDashboard: ${dashboard.error ?? 'no data'}`);
    } catch (error) {
      errors.push(
        `learning.getDashboard: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      const dashboard = await engines.brain.getDashboard();
      if (dashboard.success && dashboard.data)
        consume('enterprise-brain', 'Enterprise Brain (EI-008)');
      else errors.push(`brain.getDashboard: ${dashboard.error ?? 'no data'}`);
    } catch (error) {
      errors.push(`brain.getDashboard: ${error instanceof Error ? error.message : String(error)}`);
    }

    // EI-003/004/005 — registry engines consume knowledge for context/strategies.
    await Promise.all([
      this.tryConsume(
        'context.getContextSummary',
        () => engines.context.getContextSummary(),
        'context-intelligence',
        'Context Intelligence (EI-003)',
        consumers,
        errors,
        now,
      ),
      this.tryConsume(
        'strategies.getSummary',
        () => engines.strategies.getSummary(),
        'execution-strategy',
        'Execution Strategy (EI-004)',
        consumers,
        errors,
        now,
      ),
      this.tryConsume(
        'orchestrator.getSummary',
        () => engines.orchestrator.getSummary(),
        'execution-orchestrator',
        'Execution Orchestrator (EI-005)',
        consumers,
        errors,
        now,
      ),
    ]);

    const kept = relationships.filter((r) => knownIds.has(r.targetId));
    const updated: KnowledgeItem = {
      ...item,
      consumers,
      relationships: [...item.relationships, ...kept],
      usage: { ...item.usage, totalConsumers: consumers.length },
      updatedAt: now,
    };
    return { item: updated, relationships: kept, consumers, errors };
  }

  private async tryConsume(
    engine: string,
    call: () => Promise<{ success: boolean; data?: unknown; error?: string }>,
    consumerId: string,
    consumerLabel: string,
    consumers: KnowledgeConsumer[],
    errors: string[],
    now: string,
  ): Promise<void> {
    try {
      const response = await call();
      if (response.success && response.data !== undefined) {
        const existing = consumers.find((c) => c.consumerId === consumerId);
        if (existing) {
          existing.usageCount += 1;
          existing.lastUsedAt = now;
        } else {
          consumers.push({
            consumerId,
            consumerType: 'engine',
            consumerLabel,
            usageCount: 1,
            firstUsedAt: now,
            lastUsedAt: now,
          });
        }
      } else {
        errors.push(`${engine}: ${response.error ?? 'no data'}`);
      }
    } catch (error) {
      errors.push(`${engine}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Deterministic consumer registry entry (used by the application layer). */
  registerConsumer(
    consumerId: string,
    consumerType: KnowledgeConsumer['consumerType'],
    consumerLabel: string,
  ): KnowledgeConsumer {
    const now = new Date().toISOString();
    return {
      consumerId: consumerId || generateConsumerId(),
      consumerType,
      consumerLabel,
      usageCount: 1,
      firstUsedAt: now,
      lastUsedAt: now,
    };
  }
}
