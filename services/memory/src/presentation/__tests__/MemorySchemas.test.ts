import { describe, it, expect } from 'vitest';
import {
  captureMemorySchema,
  updateMemorySchema,
  searchQuery,
  recallQuery,
  paginationQuery,
  timelineQuery,
  mergeMemoriesSchema,
} from '../validation/MemorySchemas.js';

describe('captureMemorySchema', () => {
  it('validates a valid capture memory request', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test Memory',
      content: 'Test content body',
      category: 'experience',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = captureMemorySchema.safeParse({
      title: '',
      content: 'Test content',
      category: 'experience',
    });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 200 characters', () => {
    const result = captureMemorySchema.safeParse({
      title: 'x'.repeat(201),
      content: 'Test content',
      category: 'experience',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: '',
      category: 'experience',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'invalid_category',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    const validCategories = [
      'experience',
      'observation',
      'history',
      'reflection',
      'context',
      'conversation',
      'learning',
      'insight',
      'feedback',
      'decision',
    ];
    for (const category of validCategories) {
      const result = captureMemorySchema.safeParse({
        title: 'Test',
        content: 'Content',
        category,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional fields', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'experience',
      sourceType: 'user_input',
      sourceDetail: 'Manual entry',
      tags: ['tag1', 'tag2'],
      importanceScore: 7,
      confidenceScore: 0.8,
      knowledgeNodeId: 'kg-123',
      retentionClass: 'permanent',
      metadata: { key: 'value' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects importanceScore out of range', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'experience',
      importanceScore: 15,
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidenceScore out of range', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'experience',
      confidenceScore: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid retentionClass', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'experience',
      retentionClass: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-object metadata', () => {
    const result = captureMemorySchema.safeParse({
      title: 'Test',
      content: 'Content',
      category: 'experience',
      metadata: 'not-an-object',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMemorySchema', () => {
  it('validates with partial fields', () => {
    const result = updateMemorySchema.safeParse({
      title: 'Updated Title',
    });
    expect(result.success).toBe(true);
  });

  it('validates with all fields empty', () => {
    const result = updateMemorySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates content update', () => {
    const result = updateMemorySchema.safeParse({
      content: 'New content',
    });
    expect(result.success).toBe(true);
  });

  it('validates tags update', () => {
    const result = updateMemorySchema.safeParse({
      tags: ['new-tag', 'important'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title in update', () => {
    const result = updateMemorySchema.safeParse({
      title: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('searchQuery', () => {
  it('parses with all defaults', () => {
    const result = searchQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('parses with query string', () => {
    const result = searchQuery.safeParse({ q: 'test search' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe('test search');
    }
  });

  it('parses with category filter', () => {
    const result = searchQuery.safeParse({ category: 'experience' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid category in search', () => {
    const result = searchQuery.safeParse({ category: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('parses with state filter', () => {
    const result = searchQuery.safeParse({ state: 'active' });
    expect(result.success).toBe(true);
  });

  it('parses coerce page and limit to numbers', () => {
    const result = searchQuery.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects page below 1', () => {
    const result = searchQuery.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 100', () => {
    const result = searchQuery.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });
});

describe('recallQuery', () => {
  it('defaults strengthen to true', () => {
    const result = recallQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strengthen).toBe(true);
    }
  });

  it('parses strengthen as false', () => {
    const result = recallQuery.safeParse({ strengthen: 'false' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strengthen).toBe(false);
    }
  });

  it('parses strengthen as true', () => {
    const result = recallQuery.safeParse({ strengthen: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strengthen).toBe(true);
    }
  });
});

describe('paginationQuery', () => {
  it('provides default values', () => {
    const result = paginationQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('coerces string numbers', () => {
    const result = paginationQuery.safeParse({ page: '3', limit: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(15);
    }
  });
});

describe('timelineQuery', () => {
  it('defaults to desc order', () => {
    const result = timelineQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe('desc');
    }
  });

  it('accepts asc order', () => {
    const result = timelineQuery.safeParse({ order: 'asc' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe('asc');
    }
  });
});

describe('mergeMemoriesSchema', () => {
  it('validates merge request', () => {
    const result = mergeMemoriesSchema.safeParse({
      sourceIds: ['mem-1', 'mem-2'],
      targetLabel: 'Merged Memory',
    });
    expect(result.success).toBe(true);
  });

  it('rejects too few source IDs', () => {
    const result = mergeMemoriesSchema.safeParse({
      sourceIds: ['mem-1'],
      targetLabel: 'Merged',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too many source IDs', () => {
    const result = mergeMemoriesSchema.safeParse({
      sourceIds: Array.from({ length: 21 }, (_, i) => `mem-${i + 1}`),
      targetLabel: 'Merged',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty target label', () => {
    const result = mergeMemoriesSchema.safeParse({
      sourceIds: ['mem-1', 'mem-2'],
      targetLabel: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional target content', () => {
    const result = mergeMemoriesSchema.safeParse({
      sourceIds: ['mem-1', 'mem-2'],
      targetLabel: 'Merged Memory',
      targetContent: 'Combined content',
    });
    expect(result.success).toBe(true);
  });
});
