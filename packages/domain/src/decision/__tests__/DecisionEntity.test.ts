import { describe, it, expect } from 'vitest';
import { Decision } from '../entities/Decision.js';
import { generateDecisionId } from '../value-objects/DecisionId.js';
import { DecisionStatus } from '../value-objects/DecisionStatus.js';
import { DecisionPriority } from '../value-objects/DecisionPriority.js';

describe('Decision Entity', () => {
  const createTestDecision = () => {
    return Decision.create({
      id: generateDecisionId(),
      title: 'Test Decision',
      description: 'Test description',
      category: 'strategic',
      initiator: 'user',
      tags: ['test'],
    });
  };

  it('creates with required fields', () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Test Decision',
      description: 'Test description',
      category: 'strategic',
    });

    expect(decision.title).toBe('Test Decision');
    expect(decision.description).toBe('Test description');
    expect(decision.category).toBe('strategic');
    expect(decision.status.toString()).toBe('requested');
  });

  it('generates creation event', () => {
    const decision = createTestDecision();
    const events = decision.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('decision.created');
  });

  it('transitions through lifecycle', () => {
    const decision = createTestDecision();

    // Clear creation events
    decision.pullEvents();

    decision.startAnalysis();
    expect(decision.status.toString()).toBe('analyzing');

    decision.addOption({
      id: 'opt_1',
      label: 'Option A',
      description: 'First option',
      pros: ['Fast'],
      cons: ['Expensive'],
    });

    decision.startEvaluation();
    expect(decision.status.toString()).toBe('evaluating');

    decision.pullEvents(); // Clear events before decide
  });

  it('throws when evaluating without options', () => {
    const decision = createTestDecision();
    decision.startAnalysis();
    decision.pullEvents();

    expect(() => decision.startEvaluation()).toThrow('without options');
  });

  it('manages options correctly', () => {
    const decision = createTestDecision();
    decision.pullEvents();

    decision.addOption({
      id: 'opt_1',
      label: 'Option A',
      description: 'First option',
      pros: ['Fast'],
      cons: ['Expensive'],
    });

    expect(decision.options).toHaveLength(1);
    expect(decision.options[0]?.label).toBe('Option A');

    decision.removeOption('opt_1');
    expect(decision.options).toHaveLength(0);
  });

  it('detects duplicate options', () => {
    const decision = createTestDecision();
    decision.pullEvents();

    decision.addOption({
      id: 'opt_1',
      label: 'Option A',
      description: 'First option',
      pros: [],
      cons: [],
    });

    expect(() =>
      decision.addOption({
        id: 'opt_1',
        label: 'Duplicate',
        description: 'Should fail',
        pros: [],
        cons: [],
      }),
    ).toThrow('Option already exists');
  });

  it('updates title and description', () => {
    const decision = createTestDecision();
    decision.pullEvents();

    decision.updateTitle('New Title');
    expect(decision.title).toBe('New Title');

    decision.updateDescription('New Description');
    expect(decision.description).toBe('New Description');
  });

  it('manages tags', () => {
    const decision = createTestDecision();
    decision.addTag('new_tag');
    expect(decision.tags).toContain('new_tag');

    decision.removeTag('new_tag');
    expect(decision.tags).not.toContain('new_tag');
  });

  it('links knowledge nodes', () => {
    const decision = createTestDecision();
    decision.linkKnowledgeNode('kg_node_1');
    expect(decision.knowledgeNodeIds).toContain('kg_node_1');
  });

  it('links memories', () => {
    const decision = createTestDecision();
    decision.linkMemory('mem_1');
    expect(decision.memoryIds).toContain('mem_1');
  });

  it('prevents duplicate knowledge node links', () => {
    const decision = createTestDecision();
    decision.linkKnowledgeNode('kg_node_1');
    decision.linkKnowledgeNode('kg_node_1');
    expect(decision.knowledgeNodeIds).toHaveLength(1);
  });

  it('drains events on pullEvents', () => {
    const decision = createTestDecision();
    const events1 = decision.pullEvents();
    expect(events1).toHaveLength(1);
    const events2 = decision.pullEvents();
    expect(events2).toHaveLength(0);
  });

  it('returns ranked options by score', () => {
    const decision = createTestDecision();
    decision.pullEvents();
    decision.addOption({ id: 'a', label: 'A', description: '', pros: [], cons: [] });
    decision.addOption({ id: 'b', label: 'B', description: '', pros: [], cons: [] });

    // Both have no score, so ranked list should be empty
    const ranked = decision.getRankedOptions();
    expect(ranked).toHaveLength(0);
  });
});
