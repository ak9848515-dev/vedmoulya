// VedMoulya — Mission Controller: Frozen Foundations Regression
// BLD-021A — the five autonomous packages + re-used contracts must remain
// architecturally intact and importable. This suite proves their public APIs
// still work (compile + smoke) from the mission-controller perspective.
import { describe, it, expect } from 'vitest';

// Frozen foundation 1 — agent-execution types + services
import {
  AGENT_AUTONOMY_LEVELS,
  AGENT_RUN_STATES,
  TOOL_PERMISSION_CLASSES,
} from '@vedmoulya/agent-execution';

// Frozen foundation 2 — planning
import * as planning from '@vedmoulya/planning';

// Frozen foundation 3 — adaptive loop
import * as adaptiveLoop from '@vedmoulya/adaptive-loop';

// Frozen foundation 4 — execution memory
import * as executionMemory from '@vedmoulya/execution-memory';

// Frozen foundation 5 — experience optimization
import * as experienceOptimization from '@vedmoulya/experience-optimization';

// Frozen foundation 6 — AI type taxonomy
import * as ai from '@vedmoulya/ai';

describe('Frozen Foundations Regression (mission-controller consumes, never redefines)', () => {
  it('agent-execution exposes the frozen autonomy/state/permission contracts', () => {
    expect(AGENT_AUTONOMY_LEVELS).toContain('CONTROLLED_AUTONOMOUS');
    expect(AGENT_RUN_STATES).toContain('EXECUTING');
    expect(TOOL_PERMISSION_CLASSES).toContain('SECRETS');
  });

  it('planning public surface is intact', () => {
    expect(planning).toBeTruthy();
    expect(Object.keys(planning).length).toBeGreaterThan(0);
  });

  it('adaptive loop public surface is intact', () => {
    expect(adaptiveLoop).toBeTruthy();
    expect(Object.keys(adaptiveLoop).length).toBeGreaterThan(0);
  });

  it('execution memory public surface is intact', () => {
    expect(executionMemory).toBeTruthy();
    expect(Object.keys(executionMemory).length).toBeGreaterThan(0);
  });

  it('experience optimization public surface is intact', () => {
    expect(experienceOptimization).toBeTruthy();
    expect(Object.keys(experienceOptimization).length).toBeGreaterThan(0);
  });

  it('AI capability taxonomy is intact', () => {
    expect(ai).toBeTruthy();
    expect(Object.keys(ai).length).toBeGreaterThan(0);
  });
});
