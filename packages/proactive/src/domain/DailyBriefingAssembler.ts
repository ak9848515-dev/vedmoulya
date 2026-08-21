// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · DailyBriefingAssembler
// SPRINT-029 — Phase 6 · proactive daily intelligence (good-morning briefing).
//
// Composes the EXISTING Brain daily priorities + opportunities + risks + AI
// world updates into one concise briefing. The no-spam rule is absolute:
// if nothing meaningful exists, the briefing has `hasContent: false` and the
// caller must NOT notify the user (the scheduler cadence is the only driver;
// this layer never spams).
// ─────────────────────────────────────────────────────────────────────────────

import type { DailyBriefing } from '../types/proactive-types.js';

export interface BriefingInput {
  ownerId: string;
  now: () => string;
  priorities: { title: string; urgency: string; reason?: string }[];
  opportunities: {
    category: string;
    title: string;
    evidence: string[];
    status: string;
  }[];
  events: { kind: string; title: string; relevance: number }[];
  risks: { title: string; risk: string }[];
}

export class DailyBriefingAssembler {
  assemble(input: BriefingInput): DailyBriefing {
    const priorities = input.priorities.slice(0, 3).map((p) => p.title);
    const automationCandidate = input.opportunities.find(
      (o) => o.category === 'automation' && o.status !== 'DISMISSED',
    );
    const revenueCandidate = input.opportunities.find(
      (o) => (o.category === 'earning' || o.category === 'business') && o.status !== 'DISMISSED',
    );
    const topRisk = input.risks.slice(0, 1)[0];
    const topEvent = input.events
      .filter((e) => e.relevance >= 0.5)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 1)[0];

    const briefing: DailyBriefing = {
      ownerId: input.ownerId,
      date: input.now().slice(0, 10),
      priorities,
      hasContent: false,
    };

    // Headline: priorities when they exist, else the single most valuable
    // proactive item. Never stack every section — one clear message.
    if (priorities.length > 0) {
      briefing.recommendedAction = priorities[0];
      if (automationCandidate) briefing.automationOpportunity = automationCandidate.title;
      if (revenueCandidate) briefing.revenueOpportunity = revenueCandidate.title;
      if (topRisk) briefing.risk = topRisk.title;
      if (topEvent) briefing.aiWorldUpdate = topEvent.title;
      briefing.hasContent = true;
      return briefing;
    }

    if (automationCandidate) {
      briefing.automationOpportunity = automationCandidate.title;
      briefing.recommendedAction = `Automation opportunity: ${automationCandidate.title}`;
      briefing.hasContent = true;
      return briefing;
    }
    if (revenueCandidate) {
      briefing.revenueOpportunity = revenueCandidate.title;
      briefing.recommendedAction = `Revenue opportunity: ${revenueCandidate.title}`;
      briefing.hasContent = true;
      return briefing;
    }
    if (topRisk) {
      briefing.risk = topRisk.title;
      briefing.recommendedAction = `Address risk: ${topRisk.title}`;
      briefing.hasContent = true;
      return briefing;
    }
    if (topEvent) {
      briefing.aiWorldUpdate = topEvent.title;
      briefing.recommendedAction = `AI world update: ${topEvent.title}`;
      briefing.hasContent = true;
      return briefing;
    }

    // Nothing meaningful — no spam.
    briefing.priorities = [];
    return briefing;
  }
}
