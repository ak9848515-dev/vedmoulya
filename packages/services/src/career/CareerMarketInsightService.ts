// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Market Insight Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  MarketInsightDTO,
  MarketTrendDTO,
  CertificationDemandDTO,
  SalaryInsightDTO,
  HiringTrendDTO,
} from './CareerDTO.js';

export class CareerMarketInsightService {
  getMarketInsights(industry: string): MarketInsightDTO {
    return {
      industry,
      trends: this.getDefaultTrends(industry),
      emergingSkills: this.getEmergingSkills(industry),
      decliningSkills: this.getDecliningSkills(industry),
      certificationDemand: this.getCertificationDemand(industry),
      salaryInsights: this.getSalaryInsights(industry),
      hiringTrends: this.getHiringTrends(),
      topEmployers: this.getTopEmployers(industry),
      lastUpdated: new Date().toISOString(),
    };
  }

  private getDefaultTrends(_industry: string): MarketTrendDTO[] {
    return [
      {
        name: 'AI Integration',
        description: 'AI and machine learning are transforming workflows across all industries',
        impact: 'positive',
        timeframe: 'short',
        relevance: 85,
      },
      {
        name: 'Remote Work Evolution',
        description: 'Hybrid and remote work models continue to reshape hiring',
        impact: 'positive',
        timeframe: 'medium',
        relevance: 75,
      },
      {
        name: 'Skills-Based Hiring',
        description: 'Companies increasingly prioritize skills over degrees',
        impact: 'positive',
        timeframe: 'medium',
        relevance: 80,
      },
    ];
  }

  private getEmergingSkills(_industry: string): string[] {
    const byIndustry: Record<string, string[]> = {
      Technology: ['AI/ML', 'Cloud Native', 'Cybersecurity', 'DevOps', 'Data Engineering'],
      Finance: ['Blockchain', 'Risk Analytics', 'FinTech', 'Regulatory Tech'],
      Healthcare: ['Health Informatics', 'Telemedicine', 'Bioinformatics'],
    };
    return (
      byIndustry[_industry] ?? [
        'Digital Literacy',
        'Data Analysis',
        'AI Tools',
        'Remote Collaboration',
      ]
    );
  }

  private getDecliningSkills(_industry: string): string[] {
    return ['Legacy System Maintenance', 'Manual Data Entry', 'Basic IT Support'];
  }

  private getCertificationDemand(_industry: string): CertificationDemandDTO[] {
    return [
      {
        name: 'AWS Solutions Architect',
        provider: 'Amazon',
        demandLevel: 'high',
        averageSalaryImpact: 15000,
        relevanceToRole: 80,
      },
      {
        name: 'Project Management Professional',
        provider: 'PMI',
        demandLevel: 'high',
        averageSalaryImpact: 12000,
        relevanceToRole: 60,
      },
      {
        name: 'Certified Kubernetes Administrator',
        provider: 'CNCF',
        demandLevel: 'medium',
        averageSalaryImpact: 10000,
        relevanceToRole: 70,
      },
    ];
  }

  private getSalaryInsights(_industry: string): SalaryInsightDTO[] {
    return [
      {
        role: 'Software Engineer',
        experience: 'Mid-Level',
        percentile10: 70000,
        percentile25: 90000,
        median: 120000,
        percentile75: 155000,
        percentile90: 190000,
        location: 'United States',
        currency: 'USD',
      },
      {
        role: 'Senior Engineer',
        experience: 'Senior',
        percentile10: 120000,
        percentile25: 145000,
        median: 170000,
        percentile75: 200000,
        percentile90: 250000,
        location: 'United States',
        currency: 'USD',
      },
    ];
  }

  private getHiringTrends(): HiringTrendDTO[] {
    return [
      {
        quarter: 'Q1 2026',
        hiringVolume: 85,
        averageTimeToHire: 35,
        remotePercentage: 45,
        contractPercentage: 20,
      },
      {
        quarter: 'Q2 2026',
        hiringVolume: 92,
        averageTimeToHire: 32,
        remotePercentage: 48,
        contractPercentage: 22,
      },
    ];
  }

  private getTopEmployers(_industry: string): string[] {
    const employers: Record<string, string[]> = {
      Technology: ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta'],
      Finance: ['JPMorgan', 'Goldman Sachs', 'Morgan Stanley'],
    };
    return employers[_industry] ?? ['Top Industry Leaders'];
  }
}
