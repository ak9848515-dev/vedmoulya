// ──────────────────────────────────────────────────────────────────
// VedMoulya — GitHubRepositoryIntelligence
// EPIC-012C — repository usefulness, NOT star-count popularity
//
// A repository is never recommended because it has many stars. This
// engine derives flags (abandoned / unclear license / suspicious /
// low documentation / security concerns / inactive development) from
// evidence with labelled confidence. Unknowns stay UNKNOWN.
// ──────────────────────────────────────────────────────────────────

import type { GitHubRepositoryIntelligence } from '../types/discovery-types.js';
import type { EvidenceConfidence } from '../types/discovery-types.js';

export interface GitHubRepoInput {
  name: string;
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  lastCommitAt?: string;
  license?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class GitHubRepositoryIntelligenceEngine {
  analyze(input: GitHubRepoInput, now: () => Date): GitHubRepositoryIntelligence {
    const flags = new Set<GitHubRepositoryIntelligence['flags'][number]>();
    const flagEvidence: Record<string, string> = {};
    const securityConsiderations: string[] = [];

    // ── License ────────────────────────────────────────────────────────
    let licenseConfidence: EvidenceConfidence = 'UNKNOWN';
    if (input.license) {
      licenseConfidence = 'PROVIDER_DECLARED';
      if (/unlicensed|no-license|unknown|proprietary/i.test(input.license)) {
        flags.add('unclear_license');
        flagEvidence.unclear_license = `License field is "${input.license}" — usage rights unclear.`;
        securityConsiderations.push(
          'License is unclear — do not assume redistribution or commercial use rights.',
        );
      }
    } else {
      flags.add('unclear_license');
      flagEvidence.unclear_license = 'No license field in the repository metadata.';
      securityConsiderations.push(
        'No license detected — code cannot be legally reused without clarification.',
      );
    }

    // ── Activity / abandonment ─────────────────────────────────────────
    const lastCommitAt: string | undefined = input.lastCommitAt;
    if (input.lastCommitAt) {
      const ageMs = now().getTime() - Date.parse(input.lastCommitAt);
      const monthsInactive = ageMs / (30 * DAY_MS);
      if (monthsInactive > 12) {
        flags.add('abandoned');
        flagEvidence.abandoned = `Last commit was ${Math.floor(monthsInactive)} months ago.`;
        flags.add('inactive_development');
        flagEvidence.inactive_development =
          'No commits for over a year — maintenance is not guaranteed.';
      } else if (monthsInactive > 3) {
        flags.add('inactive_development');
        flagEvidence.inactive_development = `Last commit ${Math.floor(monthsInactive)} months ago — activity is low.`;
      }
    }

    // ── Suspicious signals ─────────────────────────────────────────────
    const suspiciousText =
      /(?:\b(send|upload|exfiltrate|collect)\b.*\b(api[- ]?key|token|secret|password)\b)/i;
    if (
      suspiciousText.test(input.description ?? '') ||
      /keylogger|remote[- ]?shell|backdoor/i.test(input.description ?? '')
    ) {
      flags.add('suspicious');
      flagEvidence.suspicious =
        'Description mentions credential collection or remote control patterns.';
      securityConsiderations.push(
        'Treat with extreme caution — suspicious credential/remote-control wording.',
      );
    }

    // ── Documentation quality (heuristic from description length) ──────
    const descriptionLength = (input.description ?? '').length;
    const documentationQuality: 'good' | 'limited' | 'unknown' =
      descriptionLength === 0 ? 'unknown' : descriptionLength > 120 ? 'good' : 'limited';
    if (documentationQuality === 'unknown') {
      flags.add('low_documentation');
      flagEvidence.low_documentation = 'Repository has no description — documentation is unknown.';
    }

    return {
      name: input.name,
      description: input.description,
      language: input.language,
      stars: input.stars,
      forks: input.forks,
      lastCommitAt,
      license: input.license,
      licenseConfidence,
      documentationQuality,
      deploymentComplexity: documentationQuality === 'unknown' ? 'UNKNOWN' : 'medium',
      selfHostable: input.license ? 'yes' : 'UNKNOWN',
      flags: [...flags],
      flagEvidence,
      securityConsiderations,
    };
  }
}
