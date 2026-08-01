// ──────────────────────────────────────────────────────────────────
// VedMoulya — Graceful Shutdown
// Ordered shutdown on SIGTERM/SIGINT:
//   stop accepting requests → drain in-flight → flush metrics →
//   close DB pools → close Redis → close AI connections → stop workers
// PH-002 — Enterprise Operations & Reliability (T2 Graceful Shutdown)
// ──────────────────────────────────────────────────────────────────

import { logger } from '../logger/index.js';

export interface ShutdownResource {
  name: string;
  close: () => Promise<void> | void;
}

export interface GracefulShutdownOptions {
  /** Max time to wait for graceful drain, in ms. Default 10s. */
  timeoutMs?: number;
  /** A hook that tells the HTTP layer to stop accepting requests. */
  onStopAcceptingRequests?: () => void | Promise<void>;
  /** A hook that drains in-flight requests (resolves when they finish). */
  onDrainRequests?: () => void | Promise<void>;
  /** A hook that flushes metrics (e.g. OtelExporter.shutdown()). */
  onFlushMetrics?: () => void | Promise<void>;
  /** Ordered resources to close: DB pools, Redis, AI providers, workers. */
  resources?: ShutdownResource[];
  /** Extra hooks run after resources (last). */
  onComplete?: () => void | Promise<void>;
}

export interface GracefulShutdownResult {
  completed: boolean;
  durationMs: number;
  errors: Error[];
}

/**
 * Graceful shutdown coordinator. Install signal handlers with `install()`;
 * call `shutdown()` directly for tests or in-process triggers.
 */
export class GracefulShutdown {
  private readonly options: Required<GracefulShutdownOptions>;
  private shuttingDown = false;
  private installed = false;
  private signalHandler?: () => void;

  constructor(options: GracefulShutdownOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 10_000,
      onStopAcceptingRequests: options.onStopAcceptingRequests ?? ((): void => {}),
      onDrainRequests: options.onDrainRequests ?? ((): void => {}),
      onFlushMetrics: options.onFlushMetrics ?? ((): void => {}),
      resources: options.resources ?? [],
      onComplete: options.onComplete ?? ((): void => {}),
    };
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /** Register SIGTERM/SIGINT handlers (idempotent). */
  install(signals: Array<'SIGTERM' | 'SIGINT'> = ['SIGTERM', 'SIGINT']): void {
    if (this.installed) return;
    this.installed = true;

    this.signalHandler = (): void => {
      void this.shutdown();
    };

    for (const signal of signals) {
      process.on(signal, this.signalHandler);
    }
    logger.info('Graceful shutdown signal handlers installed', {
      signals,
      timeoutMs: this.options.timeoutMs,
    });
  }

  /** Remove signal handlers (idempotent). */
  uninstall(): void {
    if (!this.installed || !this.signalHandler) return;
    process.removeListener('SIGTERM', this.signalHandler);
    process.removeListener('SIGINT', this.signalHandler);
    this.installed = false;
  }

  /**
   * Run the ordered shutdown sequence. Safe to call multiple times —
   * only the first call executes the sequence.
   */
  async shutdown(): Promise<GracefulShutdownResult> {
    if (this.shuttingDown) {
      return { completed: false, durationMs: 0, errors: [] };
    }
    this.shuttingDown = true;

    const started = Date.now();
    const errors: Error[] = [];

    // 1. Stop accepting requests.
    try {
      await this.options.onStopAcceptingRequests();
    } catch (error) {
      errors.push(error as Error);
      logger.error('Graceful shutdown: stop accepting requests failed', { error });
    }

    // 2. Drain in-flight requests (bounded by timeout).
    try {
      await this.withTimeout(this.options.onDrainRequests(), this.options.timeoutMs);
    } catch (error) {
      errors.push(error as Error);
      logger.warn('Graceful shutdown: drain timed out or failed', { error });
    }

    // 3. Flush metrics (OTel exporter, etc.).
    try {
      await this.options.onFlushMetrics();
    } catch (error) {
      errors.push(error as Error);
      logger.error('Graceful shutdown: flush metrics failed', { error });
    }

    // 4-7. Close resources in declaration order (DB → Redis → AI → workers).
    for (const resource of this.options.resources) {
      try {
        await this.withTimeout(Promise.resolve(resource.close()), 5_000);
        logger.info('Graceful shutdown: resource closed', { resource: resource.name });
      } catch (error) {
        errors.push(error as Error);
        logger.error('Graceful shutdown: resource close failed', {
          resource: resource.name,
          error,
        });
      }
    }

    // 8. Completion hook (last).
    try {
      await this.options.onComplete();
    } catch (error) {
      errors.push(error as Error);
      logger.error('Graceful shutdown: completion hook failed', { error });
    }

    const result: GracefulShutdownResult = {
      completed: errors.length === 0,
      durationMs: Date.now() - started,
      errors,
    };
    logger.info('Graceful shutdown completed', {
      durationMs: result.durationMs,
      errorCount: errors.length,
    });
    return result;
  }

  private async withTimeout(promise: Promise<void> | void, timeoutMs: number): Promise<void> {
    if (promise === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`shutdown step timed out after ${String(timeoutMs)}ms`));
      }, timeoutMs);
    });
    try {
      await Promise.race([promise, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
