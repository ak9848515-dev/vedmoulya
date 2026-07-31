// ──────────────────────────────────────────────────────────────────
// VedMoulya — Application Lifecycle
// Application lifecycle management with startup and shutdown hooks
// Implements BLP-001/D01 — Application bootstrap
// ──────────────────────────────────────────────────────────────────

import { logger } from '../logger/index.js';

export type LifecyclePhase =
  | 'created'
  | 'configuring'
  | 'configured'
  | 'initializing'
  | 'initialized'
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped';

export type LifecycleHook = () => Promise<void> | void;

/**
 * Tracks the application lifecycle
 */
export class ApplicationLifecycle {
  private currentPhase: LifecyclePhase = 'created';
  private startHooks: LifecycleHook[] = [];
  private stopHooks: LifecycleHook[] = [];
  private error?: Error;

  /**
   * Get current lifecycle phase
   */
  get phase(): LifecyclePhase {
    return this.currentPhase;
  }

  /**
   * Get error if any
   */
  get startupError(): Error | undefined {
    return this.error;
  }

  /**
   * Register a startup hook (called during start)
   */
  onStart(hook: LifecycleHook): void {
    this.startHooks.push(hook);
  }

  /**
   * Register a shutdown hook (called during stop)
   */
  onStop(hook: LifecycleHook): void {
    this.stopHooks.push(hook);
  }

  /**
   * Run through the startup sequence
   */
  async start(): Promise<void> {
    try {
      this.currentPhase = 'configuring';
      this.currentPhase = 'configured';
      this.currentPhase = 'initializing';
      this.currentPhase = 'initialized';
      this.currentPhase = 'starting';

      for (const hook of this.startHooks) {
        await hook();
      }

      this.currentPhase = 'started';
      logger.info('Application started', {
        startupHooks: this.startHooks.length,
      });
    } catch (error) {
      this.error = error as Error;
      this.currentPhase = 'stopped';
      logger.error('Application startup failed', { error });
      throw error;
    }
  }

  /**
   * Run through the shutdown sequence
   */
  async stop(): Promise<void> {
    this.currentPhase = 'stopping';
    logger.info('Application shutting down');

    // Run stop hooks in reverse order
    const errors: Error[] = [];
    for (const hook of this.stopHooks.reverse()) {
      try {
        await hook();
      } catch (error) {
        errors.push(error as Error);
        logger.error('Shutdown hook failed', { error });
      }
    }

    this.currentPhase = 'stopped';

    if (errors.length > 0) {
      logger.warn('Shutdown completed with errors', {
        errorCount: errors.length,
      });
    }
  }

  /**
   * Reset lifecycle (for testing)
   */
  reset(): void {
    this.currentPhase = 'created';
    this.startHooks = [];
    this.stopHooks = [];
    this.error = undefined;
  }
}

/**
 * Default application lifecycle
 */
export const appLifecycle = new ApplicationLifecycle();
