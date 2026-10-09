#!/usr/bin/env node
// AI-WIRING-001 — diagnose the REAL GoogleGeminiProvider adapter path against
// the live Gemini API. Non-mutating: it starts no mission, changes no settings,
// and persists nothing. It prints only non-secret diagnostics (provider, model,
// answer length/preview, token usage) — never the API key.
//
// Run: npx tsx scripts/diag-gemini-adapter.ts
//
// Honest boundary: this proves the ADAPTER answers with a real completion. It
// does NOT prove the application routes Ask/Mission through Gemini (that is a
// separate, authenticated application-path check).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { GoogleGeminiProvider } from '../services/orchestrator/src/providers/GoogleGeminiProvider.js';
import { AIOrchestrationService } from '@vedmoulya/services';

function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const apiKey = process.env.AI_GOOGLE_API_KEY?.trim();
if (!apiKey) {
  console.error('BLOCKED: AI_GOOGLE_API_KEY is not set — no live Gemini call was made.');
  process.exit(2);
}

const modelId = process.env.AI_GEMINI_MODEL?.trim() || undefined;
const provider = new GoogleGeminiProvider(apiKey, { ...(modelId ? { modelId } : {}) });
console.log('adapter family   :', provider.family);
console.log('adapter model    :', modelId ?? '(adapter default)');
console.log('isHealthy        :', await provider.isHealthy());

// ── 1. Plain text generation ────────────────────────────────────────────────
try {
  const res = await provider.execute({
    messages: [
      { role: 'system', content: 'Answer concisely.' },
      { role: 'user', content: 'Reply with exactly: GEMINI_ADAPTER_OK' },
    ],
    model: 'google',
    maxTokens: 32,
  });
  console.log(
    `execute -> provider=${res.provider} model=${res.model} len=${res.content.trim().length} ` +
      `tokens=${res.tokenUsage.total} content=${JSON.stringify(res.content.trim().slice(0, 60))}`,
  );
} catch (error) {
  console.log(
    'execute FAILED:',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
}

// ── 2. Streaming ────────────────────────────────────────────────────────────
try {
  let streamed = '';
  for await (const event of provider.stream({
    messages: [{ role: 'user', content: 'Reply with exactly: STREAM_OK' }],
    model: 'google',
    maxTokens: 32,
  })) {
    const e = event as { type?: string; data?: { text?: string; modelId?: string } };
    if (e.type === 'content' && typeof e.data?.text === 'string') streamed += e.data.text;
  }
  console.log(
    `stream -> len=${streamed.trim().length} content=${JSON.stringify(streamed.trim().slice(0, 60))}`,
  );
} catch (error) {
  console.log(
    'stream FAILED:',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
}

// ── 3. Structured output ────────────────────────────────────────────────────
try {
  const res = await provider.generateStructured({
    messages: [
      { role: 'user', content: 'Return a JSON object with verdict PASS and a one-word summary.' },
    ],
    model: 'google',
    maxTokens: 128,
    schema: {
      type: 'object',
      properties: { summary: { type: 'string' }, verdict: { type: 'string' } },
      required: ['summary', 'verdict'],
    },
  });
  console.log(
    `structured -> model=${res.model} content=${JSON.stringify(res.content.slice(0, 120))}`,
  );
} catch (error) {
  console.log(
    'structured FAILED:',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
}

// ── 4. Application path (real AIOrchestrationService routing) ────────────────
// Proves the RUNTIME (not just the adapter) reaches the real provider and
// returns usable content through its normal execute/validate path.
try {
  const runtime = new AIOrchestrationService();
  runtime.registerProvider(provider);
  const run = await runtime.orchestrate({
    capability: 'general_conversation',
    userInput: 'Reply with exactly: RUNTIME_OK',
    qualityTier: 'standard',
    constraints: { maxInputTokens: 2000, maxOutputTokens: 32 },
    userId: 'diag-gemini-runtime',
  });
  console.log(
    `orchestrate -> provider=${run.provider} model=${run.model} len=${run.content.trim().length} ` +
      `in=${run.tokenUsage.input} out=${run.tokenUsage.output} content=${JSON.stringify(run.content.trim().slice(0, 40))}`,
  );
} catch (error) {
  console.log(
    'orchestrate FAILED:',
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
}
