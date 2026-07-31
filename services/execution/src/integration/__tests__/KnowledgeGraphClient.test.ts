import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphClient } from '../KnowledgeGraphClient.js';

const ORIGINAL_FETCH = global.fetch;

describe('KnowledgeGraphClient', () => {
  beforeEach(() => {
    vi.stubEnv('KNOWLEDGE_SERVICE_URL', 'http://test:4003');
    vi.stubEnv('EXECUTION_KNOWLEDGE_ENABLED', 'true');
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('returns empty array when disabled', () => {
    vi.stubEnv('EXECUTION_KNOWLEDGE_ENABLED', 'false');
    const client = new KnowledgeGraphClient();
    expect(client.isEnabled()).toBe(false);
  });

  it('fetches goals successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'g1', label: 'Goal 1', description: 'First goal', properties: { priority: 8 } },
        ],
      }),
    });
    const client = new KnowledgeGraphClient();
    const goals = await client.getGoals('u1');
    expect(goals).toHaveLength(1);
    expect(goals[0]!.label).toBe('Goal 1');
    expect(goals[0]!.priority).toBe(8);
  });

  it('returns empty on HTTP error for goals', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new KnowledgeGraphClient();
    expect(await client.getGoals('u1')).toEqual([]);
  });

  it('returns empty on network error for goals', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));
    const client = new KnowledgeGraphClient();
    expect(await client.getGoals('u1')).toEqual([]);
  });

  it('fetches projects successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'p1', label: 'Project Alpha', properties: { status: 'active' } }],
      }),
    });
    const client = new KnowledgeGraphClient();
    const projects = await client.getProjects('u1');
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe('Project Alpha');
    expect(projects[0]!.status).toBe('active');
  });

  it('returns empty on HTTP error for projects', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new KnowledgeGraphClient();
    expect(await client.getProjects('u1')).toEqual([]);
  });
});
