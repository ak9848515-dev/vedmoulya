// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: CapabilityId
// Branded identifier for capabilities
// ──────────────────────────────────────────────────────────────────

export type CapabilityId = string & { readonly __brand: 'CapabilityId' };

export function createCapabilityId(value: string): CapabilityId {
  return value as CapabilityId;
}

export function generateCapabilityId(): CapabilityId {
  return `cap_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}` as CapabilityId;
}
