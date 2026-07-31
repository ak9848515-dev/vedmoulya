// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Job Matching Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { JobMatchDTO } from './CareerDTO.js';

export class CareerJobMatchingService {
  matchJobs(
    jobs: Array<{
      id: string;
      title: string;
      company: string;
      location: string;
      requiredSkills: string[];
      preferredSkills: string[];
      minExperience: number;
      salaryRange?: { min: number; max: number; median: number; currency: string };
      postedDate: string;
      applicationUrl?: string;
    }>,
    userSkills: string[],
    yearsOfExperience: number,
    targetRole: string,
  ): JobMatchDTO[] {
    return jobs
      .map((job) => {
        const matchedSkills = job.requiredSkills.filter((s) =>
          userSkills.some((us) => us.toLowerCase() === s.toLowerCase()),
        );
        const missingSkills = job.requiredSkills.filter(
          (s) => !userSkills.some((us) => us.toLowerCase() === s.toLowerCase()),
        );
        const skillMatch =
          job.requiredSkills.length > 0
            ? Math.round((matchedSkills.length / job.requiredSkills.length) * 100)
            : 50;
        const experienceMatch = Math.min(
          100,
          Math.round((yearsOfExperience / Math.max(1, job.minExperience)) * 100),
        );
        const roleRelevance = job.title
          .toLowerCase()
          .includes(targetRole.toLowerCase().split(' ')[0] ?? '')
          ? 20
          : 0;
        const growthPotential = 50 + Math.round((matchedSkills.length - missingSkills.length) * 5);
        const marketDemand = 50;
        const fitScore = Math.round(
          skillMatch * 0.4 +
            experienceMatch * 0.2 +
            growthPotential * 0.2 +
            roleRelevance * 0.1 +
            marketDemand * 0.1,
        );

        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          fitScore,
          skillMatch,
          experienceMatch,
          growthPotential: Math.min(100, growthPotential),
          marketDemand,
          salaryEstimate: job.salaryRange ? { ...job.salaryRange, source: 'market' } : undefined,
          postedDate: job.postedDate,
          applicationUrl: job.applicationUrl,
          matchedSkills,
          missingSkills,
          relevance: fitScore,
        };
      })
      .sort((a, b) => b.fitScore - a.fitScore);
  }

  findBestMatch(matches: JobMatchDTO[]): JobMatchDTO | undefined {
    return matches[0];
  }

  getMatchSummary(matches: JobMatchDTO[]): {
    total: number;
    avgFitScore: number;
    topIndustry: string;
  } {
    if (matches.length === 0) return { total: 0, avgFitScore: 0, topIndustry: '' };
    return {
      total: matches.length,
      avgFitScore: Math.round(matches.reduce((s, m) => s + m.fitScore, 0) / matches.length),
      topIndustry: matches.sort((a, b) => b.fitScore - a.fitScore)[0]?.company ?? '',
    };
  }
}
