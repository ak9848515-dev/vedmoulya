// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: DiscoveryJobPolicy
// EPIC-018 — Phase 2 default policies per job category.
//
//   Critical provider/model changes → every 6 hours
//   Provider/ecosystem discovery    → daily
//   GitHub discovery                → daily
//   Free/local AI discovery         → daily
//   AI news                         → daily
//   Deep ecosystem scan             → weekly
//
// These are DEFAULTS, not immutable hardcoded schedules: frequency is
// stored per-user on the schedule and can be changed from the UI;
// run limits/budgets are carried on the job policy so they can later
// be configured by policy/user settings without code changes.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryJobCategory, DiscoveryJobPolicy } from '../types/scheduler-types.js';
import { DEFAULT_DISCOVERY_BUDGET } from '@vedmoulya/ai-world';

/** Baseline bounded run limits for every job (mapped onto LoopBudget). */
const BASE_RUN_LIMITS = {
  maxRuntimeMs: 60_000,
  maxDiscoveryCalls: 2,
  maxSourceCalls: 8,
  maxTokens: 20_000,
  maxCostUsd: 0.05,
};

const DEFAULT_RETRY = {
  maxRetries: 1,
  baseBackoffMs: 60_000,
  maxBackoffMs: 15 * 60_000,
};

export const DEFAULT_JOB_POLICIES: Record<DiscoveryJobCategory, DiscoveryJobPolicy> = {
  CRITICAL_PROVIDER_CHANGE: {
    jobCategory: 'CRITICAL_PROVIDER_CHANGE',
    itemCategories: ['provider', 'model'],
    frequency: 'EVERY_6_HOURS',
    discoveryBudget: {
      ...DEFAULT_DISCOVERY_BUDGET,
      maxItemsPerSource: 10,
      maxItemsPerRun: 20,
      maxSourcesPerRun: 4,
    },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 6 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  PROVIDER_MODEL_DISCOVERY: {
    jobCategory: 'PROVIDER_MODEL_DISCOVERY',
    itemCategories: ['provider', 'model'],
    frequency: 'DAILY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  GITHUB_DISCOVERY: {
    jobCategory: 'GITHUB_DISCOVERY',
    itemCategories: ['github'],
    frequency: 'DAILY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  FREE_AI_RESOURCE_DISCOVERY: {
    jobCategory: 'FREE_AI_RESOURCE_DISCOVERY',
    itemCategories: ['provider', 'application'],
    frequency: 'DAILY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  LOCAL_MODEL_DISCOVERY: {
    jobCategory: 'LOCAL_MODEL_DISCOVERY',
    itemCategories: ['model', 'application'],
    frequency: 'DAILY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  AI_NEWS_DISCOVERY: {
    jobCategory: 'AI_NEWS_DISCOVERY',
    itemCategories: ['news'],
    frequency: 'DAILY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: { ...BASE_RUN_LIMITS },
    retry: { ...DEFAULT_RETRY },
    notificationCooldownMs: 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
  ECOSYSTEM_DEEP_SCAN: {
    jobCategory: 'ECOSYSTEM_DEEP_SCAN',
    itemCategories: ['provider', 'model', 'github', 'application', 'news'],
    frequency: 'WEEKLY',
    discoveryBudget: { ...DEFAULT_DISCOVERY_BUDGET },
    runLimits: {
      ...BASE_RUN_LIMITS,
      maxRuntimeMs: 120_000,
      maxDiscoveryCalls: 3,
      maxSourceCalls: 12,
    },
    retry: { ...DEFAULT_RETRY, maxRetries: 2 },
    notificationCooldownMs: 7 * 24 * 60 * 60 * 1000,
    criticalMinRelevance: 70,
  },
};
