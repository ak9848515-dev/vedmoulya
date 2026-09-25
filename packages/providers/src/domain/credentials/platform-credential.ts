// ──────────────────────────────────────────────────────────────────
// VedMoulya — Platform (deployment) credential lookup
// PROVIDER-01 — Decision 4 (runtime credential resolution)
//
// The PLATFORM credential is the deployment's own key for a provider family —
// read from the environment, exactly like the AI runtime registry
// (`@vedmoulya/core` startup/provider-runtime) does. Keeping the family → env
// key mapping in ONE table means the runtime registry, the connection tester
// and the credential resolver can never disagree about which variable
// provisions which provider.
//
// Values are never returned to a browser; this helper exists for the
// server-side resolver only.
// ──────────────────────────────────────────────────────────────────

/** Family → environment key NAMES (ordered by precedence). */
const PLATFORM_CREDENTIAL_ENV_KEYS: readonly {
  family: string;
  envKeys: readonly string[];
}[] = [
  { family: 'google', envKeys: ['AI_GOOGLE_API_KEY'] },
  { family: 'openai', envKeys: ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'] },
  { family: 'deepseek', envKeys: ['AI_DEEPSEEK_API_KEY'] },
  { family: 'anthropic', envKeys: ['AI_ANTHROPIC_API_KEY'] },
  { family: 'openrouter', envKeys: ['AI_OPENROUTER_API_KEY'] },
  // Ollama is configured by BASE URL (no credential); openai-compatible
  // endpoints are always user-supplied. Neither has a platform credential.
  { family: 'ollama', envKeys: [] },
  { family: 'openai-compatible', envKeys: [] },
];

/** The env key names that provision this family (empty for local/custom). */
export function platformCredentialEnvKeys(family: string): readonly string[] {
  return PLATFORM_CREDENTIAL_ENV_KEYS.find((entry) => entry.family === family)?.envKeys ?? [];
}

/**
 * Fold an environment record into the set of OWN names holding a non-blank
 * string, then answer from that set. Reading `env[name]` directly would let a
 * name like `toString` resolve an inherited `Object.prototype` member, and the
 * credential lookup must never report a credential that does not exist.
 */
function ownStringEnv(env: Record<string, string | undefined>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim() !== '') map.set(name, value);
  }
  return map;
}

/** The deployment's credential for a family, or undefined when unconfigured. */
export function resolvePlatformCredential(
  family: string,
  env: Record<string, string | undefined>,
): string | undefined {
  const own = ownStringEnv(env);
  for (const name of platformCredentialEnvKeys(family)) {
    const value = own.get(name);
    if (value !== undefined) return value.trim();
  }
  return undefined;
}
