// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business ViewModel Factory
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessSnapshotDTO,
  BusinessProfileDTO,
  BusinessGoalDTO,
  BusinessKPIDTO,
  BusinessMetricsDTO,
  BusinessHealthIndicatorDTO,
  BusinessRecommendationDTO,
  BusinessNotificationDTO,
  QuickActionDTO,
  BusinessTimelineDTO,
  BusinessProjectDTO,
  BusinessRiskDTO,
  BusinessOpportunityDTO,
} from './BusinessDTO.js';

export interface ProfileViewModel {
  businessName: string;
  businessType: string;
  industry: string;
  stage: string;
  teamSize: number;
  vision: string;
  mission: string;
  strengths: string[];
  weaknesses: string[];
}

export interface KPIViewModel {
  totalKpis: number;
  onTarget: number;
  atRisk: number;
  averageAchievement: number;
  topPerformer: string;
  needsAttention: string;
}

export interface RiskViewModel {
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  averageScore: number;
  topRisk: string;
  hasCriticalRisks: boolean;
}

export interface BusinessDashboardViewModel {
  profile: ProfileViewModel;
  kpis: KPIViewModel;
  risks: RiskViewModel;
  goals: BusinessGoalDTO[];
  projects: BusinessProjectDTO[];
  opportunities: BusinessOpportunityDTO[];
  metrics: BusinessMetricsDTO;
  timeline: BusinessTimelineDTO;
  recommendations: BusinessRecommendationDTO[];
  notifications: BusinessNotificationDTO[];
  quickActions: QuickActionDTO[];
  health: BusinessHealthIndicatorDTO;
  lastRefreshed: string;
}

export class BusinessViewModelFactory {
  createProfileViewModel(profile: BusinessProfileDTO): ProfileViewModel {
    return {
      businessName: profile.businessName,
      businessType: profile.businessType,
      industry: profile.industry,
      stage: profile.stage,
      teamSize: profile.teamSize,
      vision: profile.vision,
      mission: profile.mission,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
    };
  }

  createKPIViewModel(kpis: BusinessKPIDTO[]): KPIViewModel {
    const onTarget = kpis.filter((k) => k.currentValue >= k.targetValue).length;
    const atRisk = kpis.filter((k) => k.currentValue < k.targetValue * 0.5).length;
    return {
      totalKpis: kpis.length,
      onTarget,
      atRisk,
      averageAchievement:
        kpis.length > 0
          ? Math.round(
              (kpis.reduce((s, k) => s + k.currentValue / k.targetValue, 0) / kpis.length) * 100,
            )
          : 0,
      topPerformer:
        kpis.sort((a, b) => b.currentValue / b.targetValue - a.currentValue / a.targetValue)[0]
          ?.name ?? 'N/A',
      needsAttention:
        kpis.sort((a, b) => a.currentValue / a.targetValue - b.currentValue / b.targetValue)[0]
          ?.name ?? 'N/A',
    };
  }

  createRiskViewModel(risks: BusinessRiskDTO[]): RiskViewModel {
    const critical = risks.filter((r) => r.riskScore >= 15).length;
    const high = risks.filter((r) => r.riskScore >= 10 && r.riskScore < 15).length;
    return {
      totalRisks: risks.length,
      criticalCount: critical,
      highCount: high,
      averageScore:
        risks.length > 0
          ? Math.round(risks.reduce((s, r) => s + r.riskScore, 0) / risks.length)
          : 0,
      topRisk: risks.sort((a, b) => b.riskScore - a.riskScore)[0]?.title ?? 'No risks identified',
      hasCriticalRisks: critical > 0,
    };
  }

  createDashboardViewModel(snapshot: BusinessSnapshotDTO): BusinessDashboardViewModel {
    return {
      profile: this.createProfileViewModel(snapshot.profile),
      kpis: this.createKPIViewModel(snapshot.kpis),
      risks: this.createRiskViewModel(snapshot.risks),
      goals: snapshot.goals,
      projects: snapshot.projects,
      opportunities: snapshot.opportunities,
      metrics: snapshot.metrics,
      timeline: snapshot.timeline,
      recommendations: snapshot.recommendations,
      notifications: snapshot.notifications,
      quickActions: snapshot.quickActions,
      health: snapshot.health,
      lastRefreshed: snapshot.generatedAt,
    };
  }
}
