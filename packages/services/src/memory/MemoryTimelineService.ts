// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Timeline Service
// Timeline retrieval, summarization, and navigation
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository, TimelineOrder } from '@vedmoulya/domain';
import { MemoryMapper } from './MemoryMapper.js';
import type { TimelineEntryDTO, MemoryDTO } from './MemoryDTO.js';

export class MemoryTimelineService {
  private readonly repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
  }

  /** Get the timeline of memories */
  async getTimeline(
    order: TimelineOrder = 'desc',
    page: number = 1,
    limit: number = 50,
  ): Promise<{ success: boolean; data?: TimelineEntryDTO[]; error?: string }> {
    try {
      const entries = await this.repository.getTimeline(order, { page, limit });
      return { success: true, data: MemoryMapper.toTimelineEntries(entries) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Timeline error' };
    }
  }

  /** Get memories by date range */
  async getMemoriesByDateRange(
    from: Date,
    to: Date,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ success: boolean; data?: MemoryDTO[]; error?: string }> {
    try {
      const result = await this.repository.search(
        { query: '', dateFrom: from, dateTo: to },
        { page, limit },
      );
      return { success: true, data: result.data.map((m) => MemoryMapper.toDTO(m)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Date range error' };
    }
  }

  /** Get timeline summary */
  async getSummary(): Promise<{
    success: boolean;
    data?: {
      total: number;
      dateRange: { from: string; to: string };
      categories: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const total = await this.repository.count();
      const categoryDist = await this.repository.countByCategory();
      const recent = await this.repository.getTimeline('desc', { page: 1, limit: 1 });
      const oldest = await this.repository.getTimeline('asc', { page: 1, limit: 1 });

      return {
        success: true,
        data: {
          total,
          dateRange: {
            from: oldest[0]?.date.toISOString() ?? new Date().toISOString(),
            to: recent[0]?.date.toISOString() ?? new Date().toISOString(),
          },
          categories: categoryDist,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Summary error' };
    }
  }
}
