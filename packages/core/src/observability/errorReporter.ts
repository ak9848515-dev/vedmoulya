// ──────────────────────────────────────────────────────────────────
// VedMoulya — Error Reporting Hooks
// Pluggable error reporters (console, HTTP/OTLP sink) with a hub
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

export interface ErrorReportContext {
  service?: string;
  correlationId?: string;
  operation?: string;
  tags?: Record<string, string>;
  data?: Record<string, unknown>;
}

export interface ErrorReporter {
  /** Report an error. Implementations must never throw. */
  report(error: Error, context?: ErrorReportContext): void;
}

/**
 * Default reporter: structured JSON to stderr (log-friendly output).
 */
export class ConsoleErrorReporter implements ErrorReporter {
  report(error: Error, context?: ErrorReportContext): void {
    const entry = {
      level: 'error',
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    };
    console.error(JSON.stringify(entry));
  }
}

/**
 * Optional HTTP reporter that POSTs errors to a webhook/error-tracking
 * endpoint (Sentry-compatible ingestion or any JSON sink). Non-blocking;
 * failures are swallowed so error reporting never breaks the request path.
 */
export class HttpErrorReporter implements ErrorReporter {
  private readonly endpoint: string;
  private readonly service: string;
  private readonly apiKey?: string;

  constructor(options: { endpoint: string; service: string; apiKey?: string }) {
    this.endpoint = options.endpoint;
    this.service = options.service;
    this.apiKey = options.apiKey;
  }

  report(error: Error, context?: ErrorReportContext): void {
    const payload = {
      timestamp: new Date().toISOString(),
      service: context?.service ?? this.service,
      error: { name: error.name, message: error.message, stack: error.stack },
      context,
    };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {
      // Intentionally swallow: reporting must not affect the request path.
    });
  }
}

/**
 * Error reporting hub — registers multiple reporters and fans out.
 */
export class ErrorReporterHub implements ErrorReporter {
  private readonly reporters: ErrorReporter[] = [];

  constructor() {
    // Every environment logs errors to the console by default.
    this.reporters.push(new ConsoleErrorReporter());
  }

  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter);
  }

  clearReporters(): void {
    this.reporters.length = 0;
  }

  report(error: Error, context?: ErrorReportContext): void {
    for (const reporter of this.reporters) {
      try {
        reporter.report(error, context);
      } catch {
        // Never let a broken reporter propagate.
      }
    }
  }
}

/** Default error reporting hub. */
export const errorReporter = new ErrorReporterHub();
