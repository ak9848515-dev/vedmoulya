// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Skills Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { SkillDTO, SkillCategory, SkillLevel, SkillInventoryDTO } from './CareerDTO.js';

export class CareerSkillsService {
  private readonly skillStores = new Map<string, Map<string, SkillDTO>>();

  private getStore(userId: string): Map<string, SkillDTO> {
    let store = this.skillStores.get(userId);
    if (!store) {
      store = new Map();
      this.skillStores.set(userId, store);
    }
    return store;
  }

  getSkills(userId: string): SkillDTO[] {
    return Array.from(this.getStore(userId).values());
  }

  getSkillInventory(userId: string): SkillInventoryDTO {
    const skills = this.getSkills(userId);
    return { skills, totalCount: skills.length, lastAssessed: new Date().toISOString() };
  }

  getSkill(userId: string, skillId: string): SkillDTO | undefined {
    return this.getStore(userId).get(skillId);
  }

  addSkill(userId: string, skill: SkillDTO): void {
    this.getStore(userId).set(skill.id, skill);
  }

  updateSkill(userId: string, skillId: string, updates: Partial<SkillDTO>): SkillDTO {
    const store = this.getStore(userId);
    const existing = store.get(skillId);
    if (!existing) throw new Error(`Skill not found: ${skillId}`);
    const updated: SkillDTO = { ...existing, ...updates };
    store.set(skillId, updated);
    return updated;
  }

  removeSkill(userId: string, skillId: string): void {
    this.getStore(userId).delete(skillId);
  }

  getSkillsByCategory(userId: string, category: SkillCategory): SkillDTO[] {
    return this.getSkills(userId).filter((s) => s.category === category);
  }

  getSkillsByLevel(userId: string, level: SkillLevel): SkillDTO[] {
    return this.getSkills(userId).filter((s) => s.level === level);
  }

  getTopSkills(userId: string, limit: number = 10): SkillDTO[] {
    return this.getSkills(userId)
      .sort((a, b) => this.skillLevelWeight(b.level) - this.skillLevelWeight(a.level))
      .slice(0, limit);
  }

  private skillLevelWeight(level: SkillLevel): number {
    const weights: Record<SkillLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
      master: 5,
    };
    return weights[level];
  }
}
