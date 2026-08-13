// ──────────────────────────────────────────────────────────────────
// VedMoulya — Token Estimation Service
// Deterministic, provider-independent token estimation used BEFORE any
// provider call so input budgets can be enforced without an LLM.
// AI-RUNTIME-001 — Production AI Readiness (token economics)
// ──────────────────────────────────────────────────────────────────

/**
 * Deterministic token estimation for prompt budgeting.
 *
 * Heuristic: ~4 characters per token (the industry-standard approximation
 * for English text), plus per-message structural overhead (role + message
 * framing) and priming tokens. Provider SDKs report exact usage after
 * execution; this estimator exists so a budget breach is a cheap,
 * deterministic, pre-billed failure rather than an expensive surprise.
 */
/**
 * NOTE: call methods on the object itself (`TokenEstimationService.estimateMessagesTokens`)
 * — `estimateMessagesTokens` invokes `this.estimateTokens`, so destructuring the
 * methods breaks `this` binding. The object shape (rather than a static class) is
 * intentional to satisfy the repo lint rule `no-extraneous-class`.
 */
export const TokenEstimationService = {
  /** Estimate the tokens in a single text string (4 chars ≈ 1 token). */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  },

  /**
   * Estimate the input tokens for an assembled message list, including the
   * per-message structural overhead and the 2 priming tokens the Chat
   * Completions format adds.
   */
  estimateMessagesTokens(messages: ReadonlyArray<{ role: string; content: string }>): number {
    let total = 0;
    for (const message of messages) {
      total += 4 + this.estimateTokens(message.content);
    }
    return total + 2;
  },

  /** Estimated input cost in the provider's currency for a token count. */
  estimateInputCost(tokens: number, inputPerToken: number): number {
    return tokens * inputPerToken;
  },
};
