#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local Agent — CLI entrypoint
//
// Run it on the USER'S machine (next to Ollama):
//   npm run local-agent
//
// It binds a loopback-only HTTP API the web app can reach. It is an AI-runtime
// bridge only: no filesystem, no shell, no service installation.
// ─────────────────────────────────────────────────────────────────────────────

import { createDefaultLocalAgent } from './default-agent.js';
import {
  DEFAULT_LOCAL_AGENT_HOST,
  DEFAULT_LOCAL_AGENT_PORT,
  LOCAL_AGENT_ALLOWED_ORIGINS_ENV,
  parseAllowedOrigins,
  startLocalAgentServer,
} from './server.js';

function readPort(env: Record<string, string | undefined>): number {
  const raw = env.VEDMOULYA_LOCAL_AGENT_PORT;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCAL_AGENT_PORT;
}

function readAllowedOrigins(env: Record<string, string | undefined>): readonly string[] {
  const raw = Object.entries(env).find(([name]) => name === LOCAL_AGENT_ALLOWED_ORIGINS_ENV)?.[1];
  return parseAllowedOrigins(raw);
}

async function main(): Promise<void> {
  const env = process.env;
  const agent = createDefaultLocalAgent();
  const started = await startLocalAgentServer({
    agent,
    port: readPort(env),
    host: DEFAULT_LOCAL_AGENT_HOST,
    allowedOrigins: readAllowedOrigins(env),
  });

  const shutdown = (): void => {
    void started.close().then(
      () => {
        process.exit(0);
      },
      () => {
        process.exit(1);
      },
    );
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Lifecycle output goes to stderr so stdout stays clean for scripting.
  console.error(
    `[local-agent] VedMoulya Local Agent ${agent.health().version} listening on ${started.url}`,
  );
  console.error(`[local-agent] runtimes: ${agent.health().runtimes.join(', ')}`);
  console.error('[local-agent] this bridge exposes ONLY runtime discovery, models and generation.');
}

void main().catch((error: unknown) => {
  console.error(
    `[local-agent] failed to start: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
