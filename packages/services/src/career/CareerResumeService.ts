// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Resume Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { ResumeHealthDTO, ResumeSectionDTO } from './CareerDTO.js';

const REQUIRED_SECTIONS = ['contact', 'summary', 'experience', 'education', 'skills'];
const OPTIONAL_SECTIONS = [
  'certifications',
  'projects',
  'publications',
  'languages',
  'volunteering',
  'references',
];

export class CareerResumeService {
  analyzeResume(sections: Array<{ name: string; content: string }>): ResumeHealthDTO {
    const sectionResults: ResumeSectionDTO[] = [];
    const missingSections: string[] = [];

    for (const req of REQUIRED_SECTIONS) {
      const found = sections.find((s) => s.name.toLowerCase() === req);
      if (found) {
        sectionResults.push({
          name: req,
          present: true,
          completeness: Math.min(100, Math.round((found.content.length / 500) * 100)),
          wordCount: found.content.split(/\s+/).length,
          suggestions: this.getSectionSuggestions(req, found.content),
        });
      } else {
        missingSections.push(req);
        sectionResults.push({
          name: req,
          present: false,
          completeness: 0,
          wordCount: 0,
          suggestions: [`Add "${req}" section to your resume`],
        });
      }
    }

    for (const opt of OPTIONAL_SECTIONS) {
      const found = sections.find((s) => s.name.toLowerCase() === opt);
      if (found) {
        sectionResults.push({
          name: opt,
          present: true,
          completeness: Math.min(100, Math.round((found.content.length / 300) * 100)),
          wordCount: found.content.split(/\s+/).length,
          suggestions: [],
        });
      }
    }

    const presentCount = sectionResults.filter((s) => s.present).length;
    const completeness = Math.round(
      (presentCount / (REQUIRED_SECTIONS.length + OPTIONAL_SECTIONS.length)) * 100,
    );
    const atsScore = this.calculateATSScore(sections);

    return {
      completeness,
      atsScore,
      sections: sectionResults,
      missingSections,
      suggestions: this.generateSuggestions(sectionResults, atsScore),
      keywordDensity: this.analyzeKeywords(sections),
      versionCount: 1,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  private calculateATSScore(sections: Array<{ name: string; content: string }>): number {
    if (sections.length === 0) return 0;
    let score = 50;
    const fullText = sections
      .map((s) => s.content)
      .join(' ')
      .toLowerCase();
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(fullText);
    const hasPhone = /[\d\-()\s+]{7,}/.test(fullText);
    const hasLinkedIn = /linkedin/.test(fullText);
    const hasActionWords = /(achieved|improved|led|managed|created|developed|implemented)/.test(
      fullText,
    );
    const hasNumbers = /\d+/.test(fullText);
    if (hasEmail) score += 10;
    if (hasPhone) score += 5;
    if (hasLinkedIn) score += 10;
    if (hasActionWords) score += 15;
    if (hasNumbers) score += 10;
    return Math.min(100, score);
  }

  private getSectionSuggestions(section: string, content: string): string[] {
    const suggestions: string[] = [];
    if (content.length < 100) suggestions.push(`${section} section is brief. Add more detail.`);
    if (section === 'experience' && !/\d+/.test(content))
      suggestions.push('Add quantifiable achievements (numbers, percentages).');
    if (section === 'summary' && content.length < 200)
      suggestions.push('Expand your professional summary to 2-3 sentences.');
    return suggestions;
  }

  private generateSuggestions(sections: ResumeSectionDTO[], atsScore: number): string[] {
    const suggestions: string[] = [];
    if (atsScore < 60)
      suggestions.push(
        'Optimize resume for ATS by using standard section headings and keywords from job descriptions.',
      );
    const missing = sections.filter((s) => !s.present).map((s) => s.name);
    if (missing.length > 0) suggestions.push(`Add missing sections: ${missing.join(', ')}`);
    return suggestions;
  }

  private analyzeKeywords(
    sections: Array<{ name: string; content: string }>,
  ): Record<string, number> {
    const keywords: Record<string, number> = {};
    const techKeywords = [
      'javascript',
      'python',
      'react',
      'node',
      'aws',
      'docker',
      'sql',
      'agile',
      'leadership',
      'management',
      'design',
      'testing',
    ];
    const fullText = sections
      .map((s) => s.content)
      .join(' ')
      .toLowerCase();
    for (const kw of techKeywords) {
      const regex = new RegExp(kw, 'gi');
      const matches = fullText.match(regex);
      if (matches) keywords[kw] = matches.length;
    }
    return keywords;
  }
}
