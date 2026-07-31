import { describe, it, expect } from 'vitest';
import { Decision } from '@vedmoulya/domain';
import { generateDecisionId } from '@vedmoulya/domain';
import { DecisionMapper } from '../DecisionMapper.js';

describe('DecisionMapper', () => {
  it('maps decision to DTO', () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Test Decision',
      description: 'Test description',
      category: 'strategic',
      tags: ['test'],
      initiator: 'user',
    });

    const dto = DecisionMapper.toDTO(decision);
    expect(dto.title).toBe('Test Decision');
    expect(dto.category).toBe('strategic');
    expect(dto.tags).toContain('test');
    expect(dto.createdAt).toBeDefined();
    expect(dto.options).toBeDefined();
  });

  it('maps to list DTO', () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Test',
      description: 'Desc',
      category: 'operational',
    });

    const listDTO = DecisionMapper.toListDTO([decision], 1, 1, 20);
    expect(listDTO.data).toHaveLength(1);
    expect(listDTO.total).toBe(1);
    expect(listDTO.page).toBe(1);
    expect(listDTO.totalPages).toBe(1);
  });

  it('maps stats to DTO', () => {
    const statsDTO = DecisionMapper.toStatsDTO({
      total: 10,
      byCategory: { strategic: 5, operational: 5 },
      byStatus: { requested: 3, completed: 7 },
      linkedCount: 2,
    });

    expect(statsDTO.total).toBe(10);
    expect(statsDTO.byCategory.strategic).toBe(5);
    expect(statsDTO.linkedCount).toBe(2);
  });

  it('maps to contract event', () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Test',
      description: 'Desc',
      category: 'technical',
    });

    const event = DecisionMapper.toContractEvent(decision, 'created');
    expect(event.type).toBe('decision.created');
    expect(event.decisionId).toBe(decision.id);
  });
});
