// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Portfolio Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PortfolioHealthDTO, PortfolioProjectDTO } from './CareerDTO.js';

export class CareerPortfolioService {
  analyzePortfolio(
    projects: PortfolioProjectDTO[],
    hasWebsite: boolean,
    hasGitHub: boolean,
    hasLinkedIn: boolean,
    hasPersonalSite: boolean,
  ): PortfolioHealthDTO {
    const technologies = new Set<string>();
    for (const p of projects) {
      for (const t of p.technologies) technologies.add(t);
    }

    const suggestions: string[] = [];
    if (projects.length < 3) suggestions.push('Add more projects to showcase your skills');
    if (!hasPersonalSite) suggestions.push('Create a personal portfolio website');
    if (!hasGitHub) suggestions.push('Set up a GitHub profile with your projects');
    if (!hasLinkedIn) suggestions.push('Complete your LinkedIn profile');

    const completeness = Math.round(
      Math.min(projects.length / 3, 1) * 40 +
        (hasWebsite ? 15 : 0) +
        (hasGitHub ? 15 : 0) +
        (hasLinkedIn ? 15 : 0) +
        (hasPersonalSite ? 15 : 0),
    );

    return {
      completeness,
      projectCount: projects.length,
      featuredProjects: projects.slice(0, 3),
      technologies: Array.from(technologies),
      hasWebsite,
      hasGitHub,
      hasLinkedIn,
      hasPersonalSite,
      suggestions,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  addProject(existing: PortfolioHealthDTO, project: PortfolioProjectDTO): PortfolioHealthDTO {
    return {
      ...existing,
      projectCount: existing.projectCount + 1,
      featuredProjects: [...existing.featuredProjects, project].slice(0, 3),
      technologies: Array.from(new Set([...existing.technologies, ...project.technologies])),
    };
  }
}
