/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Logging Foundation
// ──────────────────────────────────────────────────────────────────

import { config } from '../config/index.js';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service?: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface Logger {
  error(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  trace(message: string, data?: Record<string, unknown>): void;
  child(service: string): Logger;
}

class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly service: string;
  private readonly correlationId?: string;

  constructor(level: LogLevel = 'debug', service: string = 'app', correlationId?: string) {
    this.level = level;
    this.service = service;
    this.correlationId = correlationId;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_RANK[level] <= LEVEL_RANK[this.level];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      correlationId: this.correlationId,
      data,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.warn(output);
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.log('trace', message, data);
  }

  child(service: string): Logger {
    return new ConsoleLogger(this.level, service, this.correlationId);
  }
}

export const logger: Logger = new ConsoleLogger(config.app.logLevel as LogLevel, config.app.name);
