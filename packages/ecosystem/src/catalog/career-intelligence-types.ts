// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: Career Intelligence Types
// SPRINT-054 — AI Career & Freelance Intelligence Workflow
//
// Typed contracts for career/freelance opportunity intelligence.
// These are DATA CONTRACTS, not engines. The existing execution
// infrastructure handles all processing.
// ──────────────────────────────────────────────────────────────────

/** Where an opportunity observation came from. */
export type OpportunitySource =
  'research_agent' | 'user_input' | 'known_database' | 'manual_entry' | 'unavailable';

/** Confidence level for opportunity data. */
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

/** A career/freelance opportunity discovered through research. */
export interface CareerOpportunity {
  /** Stable id for this opportunity. */
  id: string;
  /** Job/role title. */
  title: string;
  /** Company or client name (UNKNOWN if not yet identified). */
  company: string;
  /** Source of this opportunity. */
  source: OpportunitySource;
  /** URL or reference (where available). */
  sourceUrl?: string;
  /** When this opportunity was observed. */
  observedAt: string;
  /** Location (remote, on-site, hybrid). */
  location: string;
  /** Work mode preference. */
  workMode: 'remote' | 'onsite' | 'hybrid' | 'unknown';
  /** Required skills (from the opportunity description). */
  requiredSkills: string[];
  /** Preferred skills (nice to have). */
  preferredSkills: string[];
  /** Experience level required. */
  experienceLevel: string;
  /** Estimated compensation (UNKNOWN if not available). */
  compensation?: {
    range?: string;
    confidence: DataConfidence;
    evidence: string[];
  };
  /** Technology stack mentioned. */
  technologies: string[];
  /** Brief description of the role/opportunity. */
  description: string;
  /** Evidence this opportunity exists (never fabricated). */
  evidence: string[];
  /** Overall confidence that this is a real, current opportunity. */
  confidence: DataConfidence;
}

/** A matched opportunity with fit analysis. */
export interface MatchedOpportunity {
  /** The original opportunity. */
  opportunity: CareerOpportunity;
  /** Overall fit score (0-1, advisory only). */
  fitScore: number;
  /** Skills that match. */
  matchingSkills: string[];
  /** Skills that are missing. */
  missingSkills: string[];
  /** Why this opportunity matches (explainable). */
  matchReasons: string[];
  /** Why this opportunity might not match. */
  mismatchReasons: string[];
  /** Goal alignment (advisory). */
  goalAlignment: string;
  /** Work mode alignment. */
  workModeMatch: boolean;
  /** Learning value (advisory). */
  learningValue: string;
  /** Confidence in the match assessment. */
  confidence: DataConfidence;
}

/** A ranked opportunity with ranking rationale. */
export interface RankedOpportunity {
  /** Rank position (1 = best). */
  rank: number;
  /** The matched opportunity. */
  match: MatchedOpportunity;
  /** Ranking rationale (explainable). */
  rationale: string;
  /** Ranking criteria scores. */
  criteriaScores: {
    fit: number;
    goalAlignment: number;
    realism: number;
    learningValue: number;
    evidenceConfidence: number;
  };
}

/** A prepared proposal for the top opportunity. */
export interface CareerProposal {
  /** The ranked opportunity this proposal is for. */
  opportunity: RankedOpportunity;
  /** Summary of the opportunity. */
  opportunitySummary: string;
  /** Why the founder fits this opportunity. */
  whyFounderFits: string;
  /** Identified skill gaps. */
  skillGaps: string[];
  /** Proposed positioning (how to present the founder). */
  proposedPositioning: string;
  /** Draft proposal text. */
  draftProposal: string;
  /** Questions to ask the client/employer. */
  questionsToAsk: string[];
  /** Missing information that should be verified. */
  missingInformation: string[];
  /** Risk flags. */
  riskFlags: string[];
  /** Evidence supporting this proposal. */
  evidence: string[];
  /** Verification status. */
  verified: boolean;
  /** Verification issues (if any). */
  verificationIssues: string[];
}

/** User profile context for career matching. */
export interface CareerProfile {
  /** User's primary career goal. */
  primaryGoal: string;
  /** User's declared skills. */
  skills: string[];
  /** User's experience level. */
  experienceLevel: string;
  /** Preferred work mode. */
  preferredWorkMode: 'remote' | 'onsite' | 'hybrid' | 'any';
  /** Technology preferences. */
  technologyPreferences: string[];
  /** Income target (advisory). */
  incomeTarget?: string;
  /** Freelance preference. */
  freelancePreference: boolean;
  /** Location preference. */
  locationPreference?: string;
  /** Time availability. */
  timeAvailability?: string;
  /** Exclusions (things the user doesn't want). */
  exclusions: string[];
}

/** The complete result of a career intelligence workflow execution. */
export interface CareerIntelligenceResult {
  /** The workflow execution id. */
  executionId: string;
  /** The profile used for matching. */
  profile: CareerProfile;
  /** All opportunities discovered. */
  allOpportunities: CareerOpportunity[];
  /** Opportunities that matched the profile. */
  matchedOpportunities: MatchedOpportunity[];
  /** Top ranked opportunities. */
  rankedOpportunities: RankedOpportunity[];
  /** The prepared proposal (for the top opportunity). */
  proposal?: CareerProposal;
  /** Research status (was live search available?). */
  researchStatus: 'LIVE' | 'SIMULATED' | 'UNAVAILABLE';
  /** Timestamp. */
  generatedAt: string;
  /** Advisory flag. */
  advisory: true;
}
