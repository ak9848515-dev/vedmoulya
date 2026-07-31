// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Knowledge Map Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeMapDTO, KnowledgeNodeDTO, KnowledgeEdgeDTO } from './LearningDTO.js';

export class LearningKnowledgeService {
  private readonly maps = new Map<string, KnowledgeMapDTO>();

  getMap(userId: string): KnowledgeMapDTO {
    const map = this.maps.get(userId);
    if (map) return map;
    const empty: KnowledgeMapDTO = { nodes: [], edges: [], lastUpdated: new Date().toISOString() };
    this.maps.set(userId, empty);
    return empty;
  }

  addNode(userId: string, node: KnowledgeNodeDTO): void {
    const map = this.getMap(userId);
    map.nodes.push(node);
    map.lastUpdated = new Date().toISOString();
  }

  updateNode(userId: string, nodeId: string, updates: Partial<KnowledgeNodeDTO>): KnowledgeNodeDTO {
    const map = this.getMap(userId);
    const idx = map.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error(`Knowledge node not found: ${nodeId}`);
    map.nodes[idx] = { ...(map.nodes[idx] as KnowledgeNodeDTO), ...updates };
    map.lastUpdated = new Date().toISOString();
    return map.nodes[idx];
  }

  addEdge(userId: string, edge: KnowledgeEdgeDTO): void {
    const map = this.getMap(userId);
    if (!map.edges.some((e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId)) {
      map.edges.push(edge);
    }
    map.lastUpdated = new Date().toISOString();
  }

  getNodesByCategory(userId: string, category: string): KnowledgeNodeDTO[] {
    return this.getMap(userId).nodes.filter((n) => n.category === category);
  }
}
