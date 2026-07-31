// ──────────────────────────────────────────────────────────────────
// VedMoulya — Base Abstractions
// Abstract base classes and interfaces for services, repositories, use cases
// Implements BLP-001/D02 — Clean Architecture base patterns
// ──────────────────────────────────────────────────────────────────

import { logger, type Logger } from '../logger/index.js';
import { type Result } from '../types/index.js';

// ── Base Service ───────────────────────────────────────────────────────────

/**
 * Abstract base class for all services
 */
export abstract class BaseService {
  protected readonly logger: Logger;
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = logger.child(serviceName);
  }
}

// ── Base Repository ────────────────────────────────────────────────────────

/**
 * Abstract base class for all repositories
 */
export abstract class BaseRepository {
  protected readonly logger: Logger;
  protected readonly repositoryName: string;

  constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
    this.logger = logger.child(`repo:${repositoryName}`);
  }
}

// ── Base Use Case ──────────────────────────────────────────────────────────

/**
 * Abstract base class for use cases
 * A use case represents a single business operation
 */
export abstract class BaseUseCase<TInput, TOutput> {
  protected readonly logger: Logger;
  protected readonly useCaseName: string;

  constructor(useCaseName: string) {
    this.useCaseName = useCaseName;
    this.logger = logger.child(`usecase:${useCaseName}`);
  }

  /**
   * Execute the use case
   */
  abstract execute(input: TInput): Promise<Result<TOutput>>;

  /**
   * Validate input before execution
   */
  protected validateInput(_input: TInput): string | null {
    return null; // Override in subclasses
  }
}

// ── Base Controller ────────────────────────────────────────────────────────

/**
 * Abstract base class for controllers/API handlers
 */
export abstract class BaseController {
  protected readonly logger: Logger;
  protected readonly controllerName: string;

  constructor(controllerName: string) {
    this.controllerName = controllerName;
    this.logger = logger.child(`ctrl:${controllerName}`);
  }
}

// ── Batch Operation ────────────────────────────────────────────────────────

/**
 * Result of a batch operation
 */
export interface BatchResult<TInput, TOutput> {
  succeeded: TOutput[];
  failed: Array<{ item: TInput; error: Error }>;
  total: number;
}

/**
 * Process items in batches
 */
export async function processInBatches<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => Promise<TOutput>,
  batchSize: number = 10,
): Promise<BatchResult<TInput, TOutput>> {
  const result: BatchResult<TInput, TOutput> = {
    succeeded: [],
    failed: [],
    total: items.length,
  };

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    for (const item of batch) {
      try {
        const value = await processor(item);
        result.succeeded.push(value);
      } catch (error) {
        result.failed.push({
          item,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  return result;
}
