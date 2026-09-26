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
import { createDefaultLocalWorkspaceService } from './default-workspaces.js';
import {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_LOCAL_AGENT_HOST,
  DEFAULT_LOCAL_AGENT_PORT,
  startLocalAgentServer,
} from './server.js';

function readPort(env: Record<string, string | undefined>): number {
  const raw = env['VEDMOULYA_LOCAL_AGENT_PORT'];
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCAL_AGENT_PORT;
}

function readAllowedOrigins(env: Record<string, string | undefined>): readonly string[] {
  const raw = env['VEDMOULYA_LOCAL_AGENT_ALLOWED_ORIGINS'];
  if (raw === undefined || raw.trim() === '') return DEFAULT_ALLOWED_ORIGINS;
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

async function main(): Promise<void> {
  const env = process.env;
  const agent = createDefaultLocalAgent();
  const workspace = createDefaultLocalWorkspaceService({ env });
  const started = await startLocalAgentServer({
    agent,
    workspace,
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
  console.error(
    '[local-agent] capabilities: runtime (discovery, models, generation) and workspace (explicitly authorized, read-only).',
  );
  console.error(
    '[local-agent] the workspace capability lists and reads ONLY directories you explicitly authorize; it never writes, executes or follows symlinks.',
  );
}

void main().catch((error: unknown) => {
  console.error(
    `[local-agent] failed to start: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
