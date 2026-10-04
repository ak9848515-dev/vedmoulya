#!/usr/bin/env node
// SPRINT (Phase 2) — diagnose the REAL Ollama adapter failure seen in the live
// mission. Uses the production adapter and the production environment; prints
// only non-secret diagnostics.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { OllamaProvider } from '../services/orchestrator/src/providers/OllamaProvider.js';

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

const baseUrl = process.env.AI_OLLAMA_BASE_URL ?? 'http://localhost:11434';
console.log('baseUrl          :', baseUrl);
console.log('AI_OLLAMA_MODEL  :', process.env.AI_OLLAMA_MODEL ?? '(unset -> adapter default)');

const provider = new OllamaProvider({ baseUrl, fallbackToInstalledModel: true });
console.log('adapter model    :', provider.name);

try {
  console.log('isHealthy        :', await provider.isHealthy());
  console.log('health           :', JSON.stringify(await provider.getHealth()));
} catch (error) {
  console.log('health FAILED    :', error instanceof Error ? error.message : String(error));
}

for (const modelId of [undefined, 'qwen2.5-coder:7b-instruct', 'llama3.2']) {
  try {
    const res = await provider.execute({
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      model: 'ollama',
      maxTokens: 16,
      ...(modelId !== undefined ? { modelId } : {}),
    });
    console.log(
      `execute(modelId=${modelId ?? 'default'}) -> provider=${res.provider} model=${res.model} ` +
        `content=${JSON.stringify(res.content.slice(0, 40))} tokens=${res.tokenUsage.total}`,
    );
  } catch (error) {
    console.log(
      `execute(modelId=${modelId ?? 'default'}) FAILED:`,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}
