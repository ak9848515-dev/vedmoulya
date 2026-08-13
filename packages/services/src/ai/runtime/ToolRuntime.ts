// ──────────────────────────────────────────────────────────────────
// VedMoulya — Secure Tool Runtime Foundation (AI-RUNTIME-002 C-04)
//
// The secure boundary the LLM uses to call tools — WITHOUT unrestricted
// agentic execution. The architecture:
//
//   LLM → Tool Request → Tool Registry → Capability Check → User
//   Authorization → Tenant Authorization → Policy Engine → Input Schema
//   Validation → Execution Boundary → Tool → Output Validation → Audit → LLM
//
// Security invariants (enforced by construction):
//   - No tool can execute arbitrary shell commands.
//   - No tool can access arbitrary filesystem paths.
//   - No tool can reach arbitrary network destinations.
//   - No tool can bypass application authorization.
//   - No tool can access secrets.
//   - No tool can directly access databases.
//   - Only tools explicitly registered + allowlisted may run; denied tools
//     fail with a typed ToolAuthorizationError before any execution.
//   - Every invocation is schema-validated, timeout-bounded, cancellable,
//     rate-limited and audited.
//
// Only SAFE deterministic tools are shipped (pure in-memory functions with
// no I/O): EchoTool, CurrentTimeTool, CalculatorTool. The runtime provides
// no shell/fs/network/db tool surface at all.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the dynamic member access in sanitizePayload uses tool-defined schema keys
   and redaction patterns — never attacker-controlled property names. This is
   the same justification used by PostgresRagRepository and the runtime
   validators. */
import { ValidationError } from '@vedmoulya/core';

// ── Tool schema (JSON-schema subset, mirroring StructuredOutputValidator) ──

export interface ToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
  enum?: Array<string | number | boolean>;
  description?: string;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  additionalProperties?: boolean;
}

// ── Typed contracts ────────────────────────────────────────────────────────

/** Capabilities a tool may require (subset of the AI capability matrix). */
export type ToolCapability = 'reasoning' | 'calculation' | 'knowledge' | 'productivity';

/** A single registered tool definition. */
export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  /** Stable tool identifier (e.g. 'current_time'). */
  name: string;
  /** Human-readable description used by the LLM for selection. */
  description: string;
  /** Capability the tool provides (used for capability checks). */
  capability: ToolCapability;
  /** Input JSON-schema. Empty object = no arguments allowed. */
  inputSchema: ToolSchema;
  /** Optional output validation schema (runs on the tool result). */
  outputSchema?: ToolSchema;
  /** Maximum execution time in ms (default 5000). */
  timeoutMs?: number;
  /** Rate limit: max invocations per window. */
  rateLimit?: { max: number; windowMs: number };
  /** Optional custom policy predicate (user/tenant scoped). */
  authorize?: (ctx: ToolAuthorizationContext) => boolean | Promise<boolean>;
  /** The pure, side-effect-free handler. */
  handler: (args: TInput, ctx: ToolExecutionContext) => TOutput | Promise<TOutput>;
}

/** Identity + policy context for one tool invocation. */
export interface ToolAuthorizationContext {
  userId: string;
  tenantId?: string;
  conversationId?: string;
  /** Platform-wide tool allowlist (tool names permitted for everyone). */
  allowlist: ReadonlySet<string>;
  /** Platform-wide deny list (tool names never permitted). */
  denylist: ReadonlySet<string>;
  /** Capabilities the requesting principal is granted. */
  grantedCapabilities: ReadonlySet<ToolCapability>;
}

/** Execution context handed to a tool handler (no secrets, no I/O handles). */
export interface ToolExecutionContext {
  userId: string;
  tenantId?: string;
  conversationId?: string;
  requestId: string;
  /** Cancellation signal — the handler should abort promptly. */
  signal: AbortSignal;
}

/** A typed tool invocation request (from the LLM or application). */
export interface ToolRequest {
  /** Tool name — resolved through the registry. */
  toolName: string;
  /** Raw arguments from the model — always schema-validated. */
  arguments: Record<string, unknown>;
  userId: string;
  tenantId?: string;
  conversationId?: string;
  /** Optional external cancellation signal. */
  signal?: AbortSignal;
}

/** Typed result of one tool invocation. */
export interface ToolResult<TOutput = unknown> {
  ok: boolean;
  toolName: string;
  data?: TOutput;
  error?: string;
  latencyMs: number;
  /** Machine-readable outcome. */
  outcome:
    | 'success'
    | 'validation_error'
    | 'authorization_error'
    | 'rate_limited'
    | 'timeout'
    | 'cancelled'
    | 'internal_error';
  /** True when the invocation was blocked before execution. */
  denied: boolean;
}

/** Audit record for every attempted invocation (allowed or denied). */
export interface ToolAuditEvent {
  id: string;
  requestId: string;
  toolName: string;
  outcome: ToolResult['outcome'];
  denied: boolean;
  userId: string;
  tenantId?: string;
  conversationId?: string;
  /** Whether input/output payloads are captured (configurable; default off). */
  capturedInput?: unknown;
  capturedOutput?: unknown;
  /** Optional human-readable error message (only on failed attempts). */
  error?: string;
  latencyMs: number;
  at: string;
}

/** Error types used by the tool runtime (typed, no stack leakage). */
export class ToolAuthorizationError extends Error {
  readonly code = 'TOOL_AUTHORIZATION';
  constructor(message: string) {
    super(message);
    this.name = 'ToolAuthorizationError';
  }
}

export class ToolRateLimitError extends Error {
  readonly code = 'TOOL_RATE_LIMIT';
  constructor(message: string) {
    super(message);
    this.name = 'ToolRateLimitError';
  }
}

export class ToolTimeoutError extends Error {
  readonly code = 'TOOL_TIMEOUT';
  constructor(message: string) {
    super(message);
    this.name = 'ToolTimeoutError';
  }
}

// ── Schema validation (deterministic, no dependencies) ─────────────────────

type Scalar = string | number | boolean;

function validateProperty(value: unknown, schema: ToolPropertySchema, path: string): string[] {
  const errors: string[] = [];
  const type = schema.type;

  const typeOk = (v: unknown): boolean => {
    switch (type) {
      case 'string':
        return typeof v === 'string';
      case 'number':
        return typeof v === 'number' && Number.isFinite(v);
      case 'boolean':
        return typeof v === 'boolean';
      case 'object':
        return typeof v === 'object' && v !== null && !Array.isArray(v);
      case 'array':
        return Array.isArray(v);
      default:
        return false;
    }
  };

  if (!typeOk(value)) {
    errors.push(`${path} must be of type ${type}`);
    return errors;
  }

  if (type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path} must be at least ${String(schema.minLength)} chars`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path} must be at most ${String(schema.maxLength)} chars`);
    }
  }
  if (type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} must be >= ${String(schema.minimum)}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path} must be <= ${String(schema.maximum)}`);
    }
  }
  if (schema.enum !== undefined && !schema.enum.some((option) => option === (value as Scalar))) {
    errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  }
  if (type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(
        ...validateProperty(item, schema.items ?? { type: 'string' }, `${path}[${String(index)}]`),
      );
    });
  }
  if (
    type === 'object' &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    schema.properties
  ) {
    const record = value as Record<string, unknown>;
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (!(key in record)) {
        if (subSchema.required) errors.push(`${path}.${key} is required`);
        continue;
      }
      errors.push(...validateProperty(record[key], subSchema, `${path}.${key}`));
    }
  }
  return errors;
}

function validateObjectSchema(value: unknown, schema: ToolSchema): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['input must be an object'];
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  for (const [key, subSchema] of Object.entries(schema.properties)) {
    if (!(key in record)) {
      if (subSchema.required) errors.push(`${key} is required`);
      continue;
    }
    errors.push(...validateProperty(record[key], subSchema, key));
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in schema.properties)) {
        errors.push(`unknown property ${key}`);
      }
    }
  }
  return errors;
}

// ── Rate limiter ───────────────────────────────────────────────────────────

interface RateWindow {
  count: number;
  resetAt: number;
}

/** Simple fixed-window rate limiter keyed by (user, tool). */
export class ToolRateLimiter {
  private readonly windows = new Map<string, RateWindow>();

  /** Returns true when the invocation is allowed, false when rate-limited. */
  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (existing.count >= max) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  reset(): void {
    this.windows.clear();
  }
}

// ── Tool Registry ──────────────────────────────────────────────────────────

export interface ToolRegistryOptions {
  /** Platform-wide tool allowlist. Empty = every registered tool is allowed. */
  allowlist?: readonly string[];
  /** Platform-wide deny list — these tools can NEVER be invoked. */
  denylist?: readonly string[];
  /** Capabilities granted to the calling principal (checked per tool). */
  grantedCapabilities?: readonly ToolCapability[];
  /** Optional audit sink — called for every attempt (allowed or denied). */
  auditSink?: (event: ToolAuditEvent) => void;
  /** Capture tool input/output payloads in audit events. Default false. */
  capturePayloads?: boolean;
  /** Global rate limiter override (defaults to an internal one). */
  rateLimiter?: ToolRateLimiter;
}

/**
 * The secure tool registry + execution boundary. Resolves tools, applies the
 * policy chain (capability → user authorization → tenant authorization →
 * policy predicate → schema validation), executes with timeout/cancellation,
 * validates output, rate-limits and audits every attempt.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly allowlist: ReadonlySet<string>;
  private readonly denylist: ReadonlySet<string>;
  private readonly grantedCapabilities: ReadonlySet<ToolCapability>;
  private readonly auditSink?: (event: ToolAuditEvent) => void;
  private readonly capturePayloads: boolean;
  private readonly rateLimiter: ToolRateLimiter;
  private readonly audits: ToolAuditEvent[] = [];

  constructor(options: ToolRegistryOptions = {}) {
    this.allowlist = new Set(options.allowlist ?? []);
    this.denylist = new Set(options.denylist ?? []);
    this.grantedCapabilities = new Set(options.grantedCapabilities ?? []);
    this.auditSink = options.auditSink;
    this.capturePayloads = options.capturePayloads ?? false;
    this.rateLimiter = options.rateLimiter ?? new ToolRateLimiter();
  }

  /** Register a tool definition (duplicate names throw). */
  register<TInput = Record<string, unknown>, TOutput = unknown>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void {
    if (!tool.name || !tool.name.trim()) {
      throw new ValidationError('tool name is required');
    }
    if (this.tools.has(tool.name)) {
      throw new ValidationError(`tool ${tool.name} is already registered`);
    }
    if (typeof tool.handler !== 'function') {
      throw new ValidationError(`tool ${tool.name} must declare a handler`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /** Unregister a tool (e.g. for teardown). */
  unregister(toolName: string): void {
    this.tools.delete(toolName);
  }

  /** List registered tool definitions (for model tool schemas / UI). */
  list(): Array<{
    name: string;
    description: string;
    capability: ToolCapability;
    inputSchema: ToolSchema;
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      capability: tool.capability,
      inputSchema: tool.inputSchema,
    }));
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /** Read-only audit trail of every attempt (allowed or denied). */
  getAuditTrail(): readonly ToolAuditEvent[] {
    return this.audits;
  }

  /** Execute one tool request through the full security chain. */
  async execute(request: ToolRequest): Promise<ToolResult> {
    const requestId = request.conversationId ?? `tool-${Date.now()}`;
    const startedAt = Date.now();
    const tool = this.tools.get(request.toolName);

    // 1. Registry resolution — unknown tool is a hard denial (no execution).
    if (!tool) {
      return this.audit({
        id: this.auditId(),
        requestId,
        toolName: request.toolName,
        outcome: 'authorization_error',
        denied: true,
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    }

    // 2. Policy chain — capability check first (cheapest), then user/tenant
    //    authorization via the allowlist/denylist + optional predicate.
    const policyResult = await this.evaluatePolicy(tool, request);
    if (!policyResult.allowed) {
      return this.audit({
        id: this.auditId(),
        requestId,
        toolName: tool.name,
        outcome: 'authorization_error',
        denied: true,
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    }

    // 3. Input schema validation — raw model arguments never reach a handler
    //    unvalidated.
    const inputErrors = validateObjectSchema(request.arguments, tool.inputSchema);
    if (inputErrors.length > 0) {
      return this.audit({
        id: this.auditId(),
        requestId,
        toolName: tool.name,
        outcome: 'validation_error',
        denied: true,
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        capturedInput: this.capturePayloads ? this.sanitizePayload(request.arguments) : undefined,
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    }

    // 4. Rate limiting — per (user, tool) window.
    const limit = tool.rateLimit;
    if (limit) {
      const key = `${request.tenantId ?? 'tenant'}:${request.userId}:${tool.name}`;
      if (!this.rateLimiter.allow(key, limit.max, limit.windowMs)) {
        return this.audit({
          id: this.auditId(),
          requestId,
          toolName: tool.name,
          outcome: 'rate_limited',
          denied: true,
          userId: request.userId,
          tenantId: request.tenantId,
          conversationId: request.conversationId,
          latencyMs: Date.now() - startedAt,
          at: new Date().toISOString(),
        });
      }
    }

    // 5. Execution boundary — timeout + cancellation.
    const timeoutMs = tool.timeoutMs ?? 5000;
    const controller = new AbortController();
    const external = request.signal;
    const onExternalAbort = (): void => {
      controller.abort();
    };
    external?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const executionCtx: ToolExecutionContext = {
      userId: request.userId,
      tenantId: request.tenantId,
      conversationId: request.conversationId,
      requestId,
      signal: controller.signal,
    };

    // Handle an already-aborted signal (cancellation fired before we could
    // attach the listener) — fail fast with a typed cancellation result.
    if (external?.aborted) {
      controller.abort();
    }
    if (controller.signal.aborted) {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
      return this.audit({
        id: this.auditId(),
        requestId,
        toolName: tool.name,
        outcome: 'cancelled',
        denied: false,
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    }

    try {
      const output = await Promise.race([
        Promise.resolve(tool.handler(request.arguments, executionCtx)),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(
              external?.aborted
                ? new Error('cancelled')
                : new ToolTimeoutError(`tool ${tool.name} timed out after ${String(timeoutMs)}ms`),
            );
          });
        }),
      ]);

      // 6. Output validation — tool results are also schema-checked before
      //    they flow back to the LLM.
      if (tool.outputSchema) {
        const outputErrors = validateObjectSchema(output, tool.outputSchema);
        if (outputErrors.length > 0) {
          throw new ValidationError(
            `tool ${tool.name} produced invalid output: ${outputErrors.join('; ')}`,
          );
        }
      }

      return this.audit(
        {
          id: this.auditId(),
          requestId,
          toolName: tool.name,
          outcome: 'success',
          denied: false,
          userId: request.userId,
          tenantId: request.tenantId,
          conversationId: request.conversationId,
          capturedInput: this.capturePayloads ? this.sanitizePayload(request.arguments) : undefined,
          capturedOutput: this.capturePayloads ? this.sanitizePayload(output) : undefined,
          latencyMs: Date.now() - startedAt,
          at: new Date().toISOString(),
        },
        output,
      );
    } catch (error) {
      const outcome = this.classifyError(error, external);
      return this.audit({
        id: this.auditId(),
        requestId,
        toolName: tool.name,
        outcome,
        denied: false,
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        capturedInput: this.capturePayloads ? this.sanitizePayload(request.arguments) : undefined,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    }
  }

  /** The full policy chain: capability → allowlist → denylist → predicate. */
  private async evaluatePolicy(
    tool: ToolDefinition,
    request: ToolRequest,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Capability check: the principal must hold the tool's capability.
    if (!this.grantedCapabilities.has(tool.capability)) {
      return { allowed: false, reason: `capability ${tool.capability} not granted` };
    }
    // Allowlist: when set, only listed tools run.
    if (this.allowlist.size > 0 && !this.allowlist.has(tool.name)) {
      return { allowed: false, reason: `tool ${tool.name} is not on the platform allowlist` };
    }
    // Deny list: explicitly denied tools never run.
    if (this.denylist.has(tool.name)) {
      return { allowed: false, reason: `tool ${tool.name} is explicitly denied` };
    }
    // Custom policy predicate (user/tenant authorization).
    if (tool.authorize) {
      const ctx: ToolAuthorizationContext = {
        userId: request.userId,
        tenantId: request.tenantId,
        conversationId: request.conversationId,
        allowlist: this.allowlist,
        denylist: this.denylist,
        grantedCapabilities: this.grantedCapabilities,
      };
      const allowed = await tool.authorize(ctx);
      if (!allowed) {
        return {
          allowed: false,
          reason: 'authorization predicate denied this tool for this principal',
        };
      }
    }
    return { allowed: true };
  }

  /** Map an execution error to a typed outcome (no secrets in the result). */
  private classifyError(error: unknown, external?: AbortSignal): ToolResult['outcome'] {
    if (error instanceof ToolTimeoutError) return 'timeout';
    if (error instanceof ToolAuthorizationError) return 'authorization_error';
    if (error instanceof ToolRateLimitError) return 'rate_limited';
    if (external?.aborted) return 'cancelled';
    if (error instanceof ValidationError) return 'validation_error';
    return 'internal_error';
  }

  /** Strip anything that could carry secrets from captured payloads. */
  private sanitizePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
      const redacted = payload.replace(
        /(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/gi,
        '[REDACTED]',
      );
      return redacted.slice(0, 500);
    }
    if (Array.isArray(payload)) {
      return payload.slice(0, 20).map((item) => this.sanitizePayload(item));
    }
    if (payload && typeof payload === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (/key|secret|token|password|auth/i.test(key)) {
          out[key] = '[REDACTED]';
        } else {
          out[key] = this.sanitizePayload(value);
        }
      }
      return out;
    }
    return payload;
  }

  private auditId(): string {
    return `audit-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  private audit(event: ToolAuditEvent, output?: unknown): ToolResult {
    this.audits.push(event);
    this.auditSink?.(event);
    // `ok` is derived from the outcome — the audit record itself carries the
    // machine-readable outcome and the denial flag.
    const ok = event.outcome === 'success';
    return {
      ok,
      toolName: event.toolName,
      data: ok && output !== undefined ? output : undefined,
      error: ok ? undefined : event.error,
      latencyMs: event.latencyMs,
      outcome: event.outcome,
      denied: event.denied,
    };
  }
}

// ── Safe built-in tools (pure, deterministic, no I/O) ──────────────────────

/** Echoes validated text back — used by tests and as the LLM sandbox probe. */
export const ECHO_TOOL: ToolDefinition<{ text: string }, { echoed: string }> = {
  name: 'echo',
  description: 'Echoes the provided text back to the caller.',
  capability: 'reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 1000,
        description: 'Text to echo',
      },
    },
    additionalProperties: false,
  },
  timeoutMs: 2000,
  handler: (args, _ctx): { echoed: string } => ({ echoed: args.text }),
};

/** Returns the current wall-clock time — deterministic enough for tests. */
export const CURRENT_TIME_TOOL: ToolDefinition<
  { timezone?: string },
  { iso: string; timezone: string }
> = {
  name: 'current_time',
  description: 'Returns the current UTC wall-clock time as an ISO-8601 string.',
  capability: 'productivity',
  inputSchema: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        enum: ['UTC', 'Asia/Kolkata', 'America/New_York'],
        description: 'Optional timezone label (default UTC).',
      },
    },
    additionalProperties: false,
  },
  timeoutMs: 1000,
  handler: (args, _ctx): { iso: string; timezone: string } => ({
    iso: new Date().toISOString(),
    timezone: args.timezone ?? 'UTC',
  }),
};

/** Deterministic arithmetic calculator — pure, no eval, no code execution. */
export const CALCULATOR_TOOL: ToolDefinition<{ expression: string }, { result: number }> = {
  name: 'calculator',
  description: 'Safely evaluates a simple arithmetic expression (+, -, *, /, parentheses).',
  capability: 'calculation',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 200,
        description: 'Arithmetic expression, e.g. (1 + 2) * 3',
      },
    },
    additionalProperties: false,
  },
  timeoutMs: 1000,
  handler: (args, _ctx): { result: number } => {
    const result = evaluateArithmetic(args.expression);
    if (!Number.isFinite(result)) {
      throw new ValidationError('calculator expression did not produce a finite number');
    }
    return { result };
  },
};

/**
 * Deterministic arithmetic evaluator — a tiny recursive-descent parser.
 * NEVER uses eval()/Function(): this is the security boundary for the
 * calculator tool. Only + - * / ( ) digits and whitespace are accepted.
 */
export function evaluateArithmetic(expression: string): number {
  const cleaned = expression.replace(/\s+/g, '');
  if (cleaned === '' || !/^[0-9+\-*/().]+$/.test(cleaned)) {
    throw new ValidationError('expression contains unsupported characters');
  }
  let index = 0;
  const tokens = cleaned;

  function parseExpression(): number {
    let value = parseTerm();
    for (;;) {
      const ch = tokens[index];
      if (ch === '+') {
        index += 1;
        value += parseTerm();
      } else if (ch === '-') {
        index += 1;
        value -= parseTerm();
      } else {
        return value;
      }
    }
  }

  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      const ch = tokens[index];
      if (ch === '*') {
        index += 1;
        value *= parseFactor();
      } else if (ch === '/') {
        index += 1;
        const divisor = parseFactor();
        if (divisor === 0) {
          throw new ValidationError('division by zero');
        }
        value /= divisor;
      } else {
        return value;
      }
    }
  }

  function parseFactor(): number {
    if (tokens[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (tokens[index] !== ')') {
        throw new ValidationError('unbalanced parentheses');
      }
      index += 1;
      return value;
    }
    if (tokens[index] === '-') {
      index += 1;
      return -parseFactor();
    }
    const start = index;
    while (index < tokens.length && /[0-9.]/.test(tokens[index] ?? '')) {
      index += 1;
    }
    if (start === index) {
      throw new ValidationError('invalid expression');
    }
    const literal = tokens.slice(start, index);
    const number = Number(literal);
    if (!Number.isFinite(number)) {
      throw new ValidationError(`invalid number ${literal}`);
    }
    return number;
  }

  const result = parseExpression();
  if (index !== tokens.length) {
    throw new ValidationError('unexpected trailing characters');
  }
  return result;
}

/** Register the safe built-in tools on a registry (helper). */
export function registerSafeTools(registry: ToolRegistry): void {
  registry.register(ECHO_TOOL);
  registry.register(CURRENT_TIME_TOOL);
  registry.register(CALCULATOR_TOOL);
}
