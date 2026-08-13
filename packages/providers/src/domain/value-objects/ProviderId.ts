// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ProviderId
// Branded identifier for AI providers
// ──────────────────────────────────────────────────────────────────

export type ProviderId = string & { readonly __brand: 'ProviderId' };

export function createProviderId(value: string): ProviderId {
  return value as ProviderId;
}

export function generateProviderId(): ProviderId {
  return `prov_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}` as ProviderId;
}
