// Provider availability checker
import type { ProviderAvailabilityPort, ProviderStatus } from '../contracts/mission-ports.js';

export class SimpleProviderAvailability implements ProviderAvailabilityPort {
  private readonly providers: Array<{
    providerId: string;
    modelId: string;
    capabilities: string[];
    healthy: boolean;
  }>;

  constructor(
    providers?: Array<{
      providerId: string;
      modelId: string;
      capabilities: string[];
      healthy: boolean;
    }>,
  ) {
    this.providers = providers ?? [
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-pro',
        capabilities: ['coding', 'testing', 'debugging', 'research'],
        healthy: true,
      },
      {
        providerId: 'ollama',
        modelId: 'llama3',
        capabilities: ['coding', 'debugging'],
        healthy: true,
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getProviderStatus(requiredCapabilities: string[]): Promise<ProviderStatus> {
    const capableProviders = this.providers.filter((p) => {
      if (!p.healthy) return false;
      return requiredCapabilities.every((cap) => p.capabilities.includes(cap));
    });

    const unhealthyProviders = this.providers.filter((p) => !p.healthy).map((p) => p.providerId);

    return {
      available: capableProviders.length > 0,
      capableProviders: capableProviders.map((p) => ({
        providerId: p.providerId,
        modelId: p.modelId,
        capabilities: p.capabilities,
        healthy: p.healthy,
      })),
      unhealthyProviders,
    };
  }

  setProviderHealth(providerId: string, healthy: boolean): void {
    const provider = this.providers.find((p) => p.providerId === providerId);
    if (provider) {
      provider.healthy = healthy;
    }
  }

  addProvider(provider: {
    providerId: string;
    modelId: string;
    capabilities: string[];
    healthy: boolean;
  }): void {
    this.providers.push(provider);
  }
}
