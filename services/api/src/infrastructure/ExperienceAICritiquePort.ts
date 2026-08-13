// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Experience AI Critique Adapter (EPIC-010 Phase 8/11)
// The optional AI-powered critique seam over the frozen AI runtime — the SAME
// AIOrchestratorSpecialistPort the loop and factory reuse. A single bounded
// reasoning call critiques the generated UI against the design system +
// blueprint and returns findings in the SAME evidence-first format as the
// deterministic critic. Non-fatal: provider absence, parse failures or
// abstention return an honest abstained result and the deterministic
// evaluation stands unchanged (never a fabricated critique).
// ─────────────────────────────────────────────────────────────────────────────

import type { AIOrchestrationService } from '@vedmoulya/services';
import type { AICritiquePort, AICritiqueResult } from '@vedmoulya/experience';
import { AIOrchestratorSpecialistPort } from '@vedmoulya/loop-engine';

/** Build the OPTIONAL EPIC-010 AI critique seam over the frozen AI runtime. */
export function createExperienceAICritiquePort(ai: AIOrchestrationService): AICritiquePort {
  const specialist = new AIOrchestratorSpecialistPort(ai);
  return {
    async critique(input): Promise<AICritiqueResult> {
      try {
        const prompt = buildAICritiquePrompt(input);
        const result = await specialist.execute({
          taskId: 'experience-visual-critique',
          capability: 'reasoning',
          qualityTier: 'standard',
          userInput: prompt,
          // The AUTHENTICATED user (from ctx.userId at the router) — per-user
          // rate limiting, caches and audit attribution in the AI runtime must
          // key off the real user, never the application id.
          userId: input.userId,
          constraints: { maxOutputTokens: 1_500, maxInputTokens: 8_000 },
          enableOptimization: true,
        });
        if (result.abstained) {
          return {
            provider: result.provider,
            model: result.model,
            tokens: result.tokens,
            costUsd: result.costUsd,
            latencyMs: result.latencyMs,
            abstained: true,
            findings: [],
          };
        }
        return {
          provider: result.provider,
          model: result.model,
          tokens: result.tokens,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
          abstained: false,
          findings: parseAICritiqueFindings(result.content),
        };
      } catch (err) {
        // Non-fatal: no provider / parse failure → honest abstention. The
        // error is surfaced (not swallowed silently) so real defects are
        // discoverable while the deterministic evaluation stands.
        const detail = err instanceof Error ? err.message : String(err);
        return {
          provider: 'none',
          model: 'none',
          tokens: { input: 0, output: 0, total: 0 },
          costUsd: 0,
          latencyMs: 0,
          abstained: true,
          findings: [],
          error: `AI critique unavailable — deterministic evaluation stands (${detail})`,
        };
      }
    },
  };
}

/** Compose a BOUNDED critique prompt — never the whole repository. */
export function buildAICritiquePrompt(input: {
  applicationId: string;
  archetype: string;
  designSystem: { visualPersonality: string; tokens: Array<{ id: string; value: string }> };
  blueprint: { screens: Array<{ id: string; title: string }>; routes: string[] };
  files: Array<{ path: string; content: string }>;
}): string {
  // UI files only: view/component paths or UI-rendering extensions. Non-UI
  // lib/services files are excluded — the critic reviews presentation, not
  // business logic.
  const uiFiles = input.files
    .filter(
      (f) =>
        /\/(ui|components|screens|pages|views|layouts|features)\/.*\.(tsx|jsx|ts|js|css|html)$/.test(
          f.path,
        ) || /\.(tsx|jsx|css|html)$/.test(f.path),
    )
    .slice(0, 12);
  const code = uiFiles.map((f) => `--- ${f.path} ---\n${f.content.slice(0, 2_500)}`).join('\n\n');
  const tokens = input.designSystem.tokens
    .slice(0, 24)
    .map((t) => `${t.id}=${t.value}`)
    .join(', ');
  const screens = input.blueprint.screens.map((s) => `${s.id} (${s.title})`).join(', ');
  return [
    `You are a world-class UI/UX critic for a generated ${input.archetype} application.`,
    `Design language: ${input.designSystem.visualPersonality}.`,
    `Design tokens: ${tokens}.`,
    `Screens: ${screens}.`,
    `Generated files (bounded preview):\n${code}`,
    '',
    'Critique the UI against hierarchy, spacing, alignment, consistency, readability,',
    'responsiveness, accessibility, interaction clarity, visual density and domain',
    'appropriateness. Return ONLY a JSON object of the form:',
    '{"findings":[{"severity":"HIGH|MEDIUM|LOW","area":"hierarchy|spacing|alignment|consistency|readability|responsiveness|accessibility|interaction_clarity|visual_density|domain_appropriateness","location":"screen|component|file","issue":"...","evidence":"...","recommendation":"...","confidence":"HIGH|MEDIUM|LOW"}]}',
    'RULES: every finding MUST quote concrete evidence visible in the code above.',
    'If evidence is insufficient or conflicting, ABSTAIN by returning {"findings":[]}.',
    'Never invent defects. Never claim a defect exists without quoting the code.',
  ].join('\n');
}

/** Parse the critique JSON defensively (tolerant of markdown fences). */
export function parseAICritiqueFindings(content: string): AICritiqueResult['findings'] {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const raw = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(raw)) return [];
  const severities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  const areas = new Set([
    'hierarchy',
    'spacing',
    'alignment',
    'consistency',
    'readability',
    'responsiveness',
    'accessibility',
    'interaction_clarity',
    'visual_density',
    'domain_appropriateness',
  ]);
  const confidences = new Set(['HIGH', 'MEDIUM', 'LOW']);
  const valid = raw
    .filter((item): item is NonNullable<AICritiqueResult['findings']>[number] => {
      if (typeof item !== 'object' || item === null) return false;
      const f = item as Record<string, unknown>;
      return (
        typeof f.severity === 'string' &&
        severities.has(f.severity) &&
        typeof f.area === 'string' &&
        areas.has(f.area) &&
        typeof f.location === 'string' &&
        typeof f.issue === 'string' &&
        f.issue.length > 0 &&
        typeof f.evidence === 'string' &&
        f.evidence.length > 0 &&
        typeof f.recommendation === 'string' &&
        typeof f.confidence === 'string' &&
        confidences.has(f.confidence)
      );
    })
    // Hard cap AFTER shape-filtering: a hallucinating or prompt-injected model
    // (file content is embedded in the prompt) must not flood the merge or the
    // QUALITY tab — and junk items can never starve valid findings.
    .slice(0, 20)
    .map((f) => ({
      severity: f.severity,
      area: f.area,
      location: f.location,
      issue: f.issue,
      evidence: f.evidence,
      recommendation: f.recommendation,
      confidence: f.confidence,
    }));
  return valid;
}
