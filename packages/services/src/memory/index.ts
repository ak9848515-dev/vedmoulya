// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Application Services
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export { MemoryApplicationService } from './MemoryApplicationService.js';
export { MemoryTimelineService } from './MemoryTimelineService.js';
export { MemorySearchService } from './MemorySearchService.js';
export { MemoryReflectionService } from './MemoryReflectionService.js';
export { MemoryRetentionService } from './MemoryRetentionService.js';
export { MemoryMapper } from './MemoryMapper.js';

export type {
  CreateMemoryDTO,
  UpdateMemoryDTO,
  RecallMemoryDTO,
  MemoryQueryDTO,
  TimelineQueryDTO,
  MemoryDTO,
  MemoryListDTO,
  TimelineEntryDTO,
  MemoryStatsDTO,
  DecayResultDTO,
  ConsolidationSuggestionDTO,
  RetentionResultDTO,
  MemoryContractEvent,
} from './MemoryDTO.js';

export type {
  MemoryQuery,
  MemoryContextQuery,
  CaptureMemoryCommand,
  RecallMemoryCommand,
  MemoryContextResult,
  MemoryContractMessage,
  MemoryContractResult,
} from './MemoryContracts.js';
