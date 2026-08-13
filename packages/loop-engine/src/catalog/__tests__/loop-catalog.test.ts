import { describe, expect, it } from 'vitest';
import {
  capabilitiesForPattern,
  detectGoalPattern,
  patternLabel,
  specialistLabel,
  templatesForPattern,
} from '../loop-catalog.js';

describe('loop-catalog', () => {
  it('detects the ABAP debugger pattern from keywords', () => {
    expect(detectGoalPattern('Fix this ABAP dump in my SAP system')).toBe('abap-debugger');
    expect(detectGoalPattern('I need an ABAP debugger for a short dump')).toBe('abap-debugger');
  });

  it('detects the app-builder pattern for restaurant apps', () => {
    expect(detectGoalPattern('Build a modern restaurant application')).toBe('app-builder');
    expect(detectGoalPattern('Build a mobile app for my cafe')).toBe('app-builder');
  });

  it('detects the AI app-builder pattern', () => {
    expect(detectGoalPattern('Build an AI app for lead scoring')).toBe('ai-app-builder');
  });

  it('falls back to generic', () => {
    expect(detectGoalPattern('organize my weekly review notes')).toBe('generic');
  });

  it('maps capabilities per pattern', () => {
    expect(capabilitiesForPattern('abap-debugger', '')).toContain('coding');
    expect(capabilitiesForPattern('ai-app-builder', '')).toContain('content_generation');
  });

  it('provides human labels for capabilities and patterns', () => {
    expect(specialistLabel('coding')).toBe('Coding Specialist');
    expect(specialistLabel('unknown' as never)).toBe('unknown');
    expect(patternLabel('app-builder')).toContain('Application Builder');
  });

  it('produces the three controlled demonstration templates', () => {
    expect(templatesForPattern('abap-debugger')).toHaveLength(7);
    expect(templatesForPattern('app-builder')).toHaveLength(6);
    expect(templatesForPattern('ai-app-builder')).toHaveLength(6);
    expect(templatesForPattern('generic')).toHaveLength(7);
    // Templates are declarative: every one declares capability/phase/expectedOutput.
    for (const template of templatesForPattern('abap-debugger')) {
      expect(template.capability).toBeTruthy();
      expect(template.expectedOutput.length).toBeGreaterThan(0);
      expect(template.prompt).toContain('{goal}');
    }
  });
});
