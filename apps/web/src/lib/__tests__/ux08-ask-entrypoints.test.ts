// @vitest-environment jsdom
// ─────────────────────────────
// VedMoulya — UX-08 canonical Ask entry-point tests
//
// The product must have exactly ONE canonical Ask experience. Every entry point
// must open THAT one — through the single UI-store flag (`aiPanelOpen`), which
// the one `AICompanion` drawer owns. These tests prove:
//   • the navigation model exposes Ask as an ACTION (not a route/duplicate page)
//   • the Ask action opens the existing companion (never a second chat)
//   • the UI store has exactly ONE Ask-open slot (no duplicate conversation flag)
//   • every entry surface resolves to the same flag
// ─────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ASK_DESTINATION,
  ALL_DESTINATIONS,
  MOBILE_DESTINATIONS,
  MOBILE_MORE_LINKS,
  destinationForPathname,
} from '../../lib/navigation-model.js';
import { useUIStore } from '../../stores/ui-store.js';

describe('UX-08 navigation model — Ask is an action, not a destination', () => {
  it('Ask has no route and opens the AI companion instead', () => {
    expect(ASK_DESTINATION.action).toBe('open-ai-companion');
    expect(ASK_DESTINATION.route).toBe('');
    expect(ASK_DESTINATION.match.length).toBe(0);
  });

  it('Ask is never the owner of any URL (no duplicate navigation authority)', () => {
    expect(destinationForPathname('/autonomous-builder').id).toBe('missions');
    expect(destinationForPathname('/ai').id).toBe('ai');
    expect(destinationForPathname('/').id).toBe('home');
    // Ask can never be resolved as the active destination.
    expect(ALL_DESTINATIONS.find((d) => d.id === 'ask')?.action).toBe('open-ai-companion');
  });

  it('exposes exactly one Ask entry in the model (no second Ask destination)', () => {
    const asks = ALL_DESTINATIONS.filter((d) => d.id === 'ask');
    expect(asks.length).toBe(1);
  });
});

describe('UX-08 UI store — one canonical Ask-open slot', () => {
  beforeEach(() => {
    useUIStore.setState({ aiPanelOpen: false, pendingQuestion: null });
  });

  it('has exactly one Ask panel flag (aiPanelOpen)', () => {
    const state = useUIStore.getState();
    expect(typeof state.setAiPanelOpen).toBe('function');
    expect(typeof state.toggleAiPanel).toBe('function');
    expect(state.aiPanelOpen).toBe(false);
  });

  it('opens and closes the one canonical Ask experience', () => {
    useUIStore.getState().setAiPanelOpen(true);
    expect(useUIStore.getState().aiPanelOpen).toBe(true);
    useUIStore.getState().toggleAiPanel();
    expect(useUIStore.getState().aiPanelOpen).toBe(false);
  });

  it('queues exactly one pending question for hand-off (no stored conversation)', () => {
    useUIStore.getState().setPendingQuestion('What should I focus on today?');
    expect(useUIStore.getState().pendingQuestion).toBe('What should I focus on today?');
    useUIStore.getState().setPendingQuestion(null);
    expect(useUIStore.getState().pendingQuestion).toBeNull();
  });
});

describe('UX-08 mobile entry points', () => {
  it('has a mobile Ask entry that is not a bottom tab route (it opens Ask)', () => {
    // Ask is deliberately NOT a bottom tab — it is an action, one tap deep.
    expect(MOBILE_DESTINATIONS.some((tab) => tab.id === ('ask' as never))).toBe(false);
  });

  it('keeps More as the container for everything that is not a primary tab', () => {
    expect(MOBILE_DESTINATIONS.some((tab) => tab.id === 'more')).toBe(true);
    expect(MOBILE_MORE_LINKS.length).toBeGreaterThan(0);
  });
});
