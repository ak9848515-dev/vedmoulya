import { describe, it, expect } from 'vitest';
import { LearningKnowledgeService } from '../LearningKnowledgeService.js';
import type { KnowledgeNodeDTO, KnowledgeEdgeDTO } from '../LearningDTO.js';

describe('LearningKnowledgeService', () => {
  it('returns empty map for new user', () => {
    const svc = new LearningKnowledgeService();
    const map = svc.getMap('user1');
    expect(map.nodes).toEqual([]);
    expect(map.edges).toEqual([]);
  });

  it('adds nodes to the map', () => {
    const svc = new LearningKnowledgeService();
    const node: KnowledgeNodeDTO = {
      id: 'n1',
      name: 'React',
      category: 'frontend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    };
    svc.addNode('user1', node);
    expect(svc.getMap('user1').nodes.length).toBe(1);
  });

  it('updateNode modifies existing node', () => {
    const svc = new LearningKnowledgeService();
    svc.addNode('user1', {
      id: 'n1',
      name: 'React',
      category: 'frontend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    });
    const updated = svc.updateNode('user1', 'n1', { masteryLevel: 80 });
    expect(updated.masteryLevel).toBe(80);
  });

  it('updateNode throws for missing node', () => {
    const svc = new LearningKnowledgeService();
    expect(() => svc.updateNode('user1', 'nope', {})).toThrow('not found');
  });

  it('addEdge adds edge without duplicates', () => {
    const svc = new LearningKnowledgeService();
    svc.addNode('user1', {
      id: 'n1',
      name: 'React',
      category: 'frontend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    });
    svc.addNode('user1', {
      id: 'n2',
      name: 'Redux',
      category: 'frontend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    });
    const edge: KnowledgeEdgeDTO = {
      sourceId: 'n1',
      targetId: 'n2',
      relationship: 'depends_on',
      strength: 80,
    };
    svc.addEdge('user1', edge);
    svc.addEdge('user1', edge); // duplicate
    expect(svc.getMap('user1').edges.length).toBe(1);
  });

  it('getNodesByCategory filters correctly', () => {
    const svc = new LearningKnowledgeService();
    svc.addNode('user1', {
      id: 'n1',
      name: 'React',
      category: 'frontend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    });
    svc.addNode('user1', {
      id: 'n2',
      name: 'Node',
      category: 'backend',
      masteryLevel: 50,
      confidence: 80,
      connections: 0,
    });
    expect(svc.getNodesByCategory('user1', 'frontend').length).toBe(1);
    expect(svc.getNodesByCategory('user1', 'backend').length).toBe(1);
    expect(svc.getNodesByCategory('user1', 'devops').length).toBe(0);
  });
});
