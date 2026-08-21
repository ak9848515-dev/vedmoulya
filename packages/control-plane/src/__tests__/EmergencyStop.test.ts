import { describe, expect, it } from 'vitest';
import { EmergencyStop, type EmergencyStopStore } from '../domain/EmergencyStop.js';
import type { EmergencyStopState } from '../types/control-types.js';

function createStore(): EmergencyStopStore {
  let state: EmergencyStopState | undefined;
  return {
    get: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function fixedNow(): string {
  return '2026-08-14T10:00:00.000Z';
}

describe('EmergencyStop (SPRINT-031)', () => {
  it('is NOT engaged by default (no record) — but never assumes safe on ambiguity', () => {
    const store = createStore();
    const stop = new EmergencyStop(store, fixedNow);
    expect(stop.isEngaged('u1')).toBe(false);
  });

  it('ENGAGE halts pathways and records WHO/WHEN/WHY/STATE-BEFORE/AFTER', () => {
    const store = createStore();
    const stop = new EmergencyStop(store, fixedNow);
    stop.engage({
      ownerId: 'u1',
      actor: 'alice',
      reason: 'Runaway automation suspected',
      source: 'user',
    });

    expect(stop.isEngaged('u1')).toBe(true);
    const state = store.get('u1')!;
    expect(state.engaged).toBe(true);
    expect(state.engagedBy).toBe('alice');
    expect(state.history[0]).toMatchObject({
      action: 'ENGAGE',
      actor: 'alice',
      engagedBefore: false,
      engagedAfter: true,
      timestamp: '2026-08-14T10:00:00.000Z',
    });
  });

  it('RELEASE clears the stop and records the reversal with prior state', () => {
    const store = createStore();
    const stop = new EmergencyStop(store, fixedNow);
    stop.engage({ ownerId: 'u1', actor: 'alice', reason: 'test', source: 'user' });
    stop.release({ ownerId: 'u1', actor: 'alice', reason: 'Investigated — safe', source: 'user' });

    expect(stop.isEngaged('u1')).toBe(false);
    const history = store.get('u1')!.history;
    expect(history[1]).toMatchObject({
      action: 'RELEASE',
      engagedBefore: true,
      engagedAfter: false,
    });
  });

  it('treats a malformed engaged record as engaged (fail-closed on ambiguity)', () => {
    const store: EmergencyStopStore = {
      get: () => ({ ownerId: 'u1', engaged: true, history: [] }) as EmergencyStopState,
      save: () => {},
    };
    const stop = new EmergencyStop(store, fixedNow);
    expect(stop.isEngaged('u1')).toBe(true);
  });

  it('never deletes data — history is preserved and bounded', () => {
    const store = createStore();
    const stop = new EmergencyStop(store, fixedNow);
    for (let i = 0; i < 5; i++) {
      stop.engage({ ownerId: 'u1', actor: 'a', reason: `engage ${i}`, source: 'user' });
      stop.release({ ownerId: 'u1', actor: 'a', reason: `release ${i}`, source: 'user' });
    }
    const state = store.get('u1')!;
    expect(state.history.length).toBe(10);
    expect(stop.history('u1').length).toBe(10);
  });
});
