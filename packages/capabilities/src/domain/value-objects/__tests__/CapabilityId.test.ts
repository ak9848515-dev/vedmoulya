import { describe, expect, it } from 'vitest';
import { createCapabilityId, generateCapabilityId } from '../CapabilityId.js';

describe('CapabilityId', () => {
  it('creates from string', () => {
    const id = createCapabilityId('cap_writing');
    expect(id).toBe('cap_writing');
  });

  it('generates unique IDs', () => {
    const id1 = generateCapabilityId();
    const id2 = generateCapabilityId();
    expect(id1).not.toBe(id2);
  });

  it('generated IDs start with cap_', () => {
    const id = generateCapabilityId();
    expect(id.startsWith('cap_')).toBe(true);
  });
});
