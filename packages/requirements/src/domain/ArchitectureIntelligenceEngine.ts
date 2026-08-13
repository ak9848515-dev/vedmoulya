// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Architecture Intelligence Engine
// EPIC-009 — Phase 16. Produces a ProductArchitecture where every
// major technology choice carries Choice / Reason / Alternative /
// Tradeoff. Covers frontend, backend, database, auth, authorization,
// AI, RAG, tools, integrations, observability, testing and deployment.
// Avoids unnecessary complexity.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype, DeploymentTargetId } from '@vedmoulya/app-factory';
import type {
  ArchitectureApiEndpoint,
  ArchitectureChoice,
  ArchitectureDataEntity,
  ProductArchitecture,
} from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface ArchitectureInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Answers that modify the architecture (e.g. online payment, delivery). */
  answers: Array<{ questionId: string; answer: string }>;
  deploymentTarget?: DeploymentTargetId;
}

export class ArchitectureIntelligenceEngine {
  derive(input: ArchitectureInput): ProductArchitecture {
    const k = knowledgeFor(input.archetype);
    const answers = new Map(input.answers.map((a) => [a.questionId, a.answer]));

    const choices: ArchitectureChoice[] = k.stack.map((s) => ({
      layer: s.layer,
      choice: s.choice,
      reason: s.reason,
      alternative: s.alternative,
      tradeoff: s.tradeoff,
    }));

    // Answer-driven architecture adjustments.
    if (
      answers.get('q-restaurant-payment') === 'online' ||
      answers.get('q-restaurant-payment') === 'both'
    ) {
      choices.push({
        layer: 'Payment',
        choice: 'Payment provider adapter (tokenized, never raw cards)',
        reason: 'online payment is an architecture-changing integration',
        alternative: 'Cash/at-restaurant only',
        tradeoff: 'adds a vendor dependency and PCI-scope awareness but enables online orders',
      });
    }
    if (
      (answers.get('q-restaurant-service-modes') ?? '').includes('delivery') ||
      answers.get('q-restaurant-service-modes') === 'all'
    ) {
      choices.push({
        layer: 'Delivery',
        choice: 'Order modes incl. delivery address + status model',
        reason: 'delivery mode changes the order data model and staff workflow',
        alternative: 'Dine-in/takeaway only',
        tradeoff: 'adds address validation and delivery-status states',
      });
    }

    const dataModel = this.adaptDataModel(k.dataModel, answers);
    const apiContract = this.adaptApiContract(k.apiContract, answers);
    const integrations = k.tools.map((t) => ({ name: t.name, purpose: t.purpose }));

    return {
      sessionId: input.sessionId,
      choices,
      dataModel,
      apiContract,
      integrations,
      observability: [
        'Request correlation ids through the gateway',
        'Latency + error metrics per endpoint',
        'Structured logs without secrets or PII',
      ],
      testing: [
        'Unit tests for core business logic',
        'Integration tests for API contracts',
        'Deterministic fixtures (no live AI in tests)',
        'Validation gates: lint → typecheck → tests → build',
      ],
      deployment: {
        target: input.deploymentTarget ?? k.deploymentTarget,
        steps: [
          'Package the validated project',
          'Deploy through the approved deployment adapter',
          'Verify health checks after deploy',
        ],
      },
      complexityGuard: [
        ...k.nonGoals,
        ...k.deniedTools.map((t) => `No ${t} access`),
        'No unnecessary AI, RAG or integrations',
      ],
    };
  }

  private adaptDataModel(
    base: ArchitectureDataEntity[],
    answers: Map<string, string>,
  ): ArchitectureDataEntity[] {
    const model = base.map((e) => ({ entity: e.entity, fields: e.fields.map((f) => ({ ...f })) }));
    if (
      answers.get('q-restaurant-payment') === 'online' ||
      answers.get('q-restaurant-payment') === 'both'
    ) {
      const order = model.find((e) => e.entity === 'Order');
      if (order) {
        order.fields.push({ name: 'paymentStatus', type: 'text' });
        order.fields.push({ name: 'paymentTokenRef', type: 'text' });
      }
    }
    if (
      (answers.get('q-restaurant-service-modes') ?? '').includes('delivery') ||
      answers.get('q-restaurant-service-modes') === 'all'
    ) {
      const order = model.find((e) => e.entity === 'Order');
      if (order) {
        order.fields.push({ name: 'deliveryAddress', type: 'text' });
        order.fields.push({ name: 'mode', type: 'text' });
      }
    }
    return model;
  }

  private adaptApiContract(
    base: ArchitectureApiEndpoint[],
    answers: Map<string, string>,
  ): ArchitectureApiEndpoint[] {
    const contract = base.map((e) => ({ ...e }));
    if (
      answers.get('q-restaurant-payment') === 'online' ||
      answers.get('q-restaurant-payment') === 'both'
    ) {
      contract.push({
        endpoint: '/api/payments',
        method: 'POST',
        purpose: 'create a payment intent',
        authRequired: true,
      });
      contract.push({
        endpoint: '/api/payments/:id/status',
        method: 'GET',
        purpose: 'payment status',
        authRequired: true,
      });
    }
    if (
      (answers.get('q-restaurant-service-modes') ?? '').includes('delivery') ||
      answers.get('q-restaurant-service-modes') === 'all'
    ) {
      contract.push({
        endpoint: '/api/orders/:id/delivery',
        method: 'GET',
        purpose: 'delivery status',
        authRequired: true,
      });
    }
    return contract;
  }
}

export type { ArchitectureChoice, ArchitectureDataEntity, ArchitectureApiEndpoint };
