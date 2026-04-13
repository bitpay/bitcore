import { AlchemyAdapter } from './alchemy';
import { MoralisAdapter } from './moralis';
import type { IIndexedAPIAdapter } from './IIndexedAPIAdapter';
import type { IMultiProviderConfig } from '../../../../types/Config';

export class AdapterFactory {
  private static registry: Record<string, new (config: IMultiProviderConfig) => IIndexedAPIAdapter> = {
    alchemy: AlchemyAdapter,
    moralis: MoralisAdapter
  };

  static createAdapter(providerConfig: IMultiProviderConfig): IIndexedAPIAdapter {
    const AdapterClass = this.registry[providerConfig.name.toLowerCase()];
    if (!AdapterClass) {
      throw new Error(
        `Unknown indexed API provider: "${providerConfig.name}". ` +
        `Available: ${Object.keys(this.registry).join(', ')}`
      );
    }
    return new AdapterClass(providerConfig);
  }

  static registerAdapter(name: string, adapterClass: new (config: IMultiProviderConfig) => IIndexedAPIAdapter): void {
    this.registry[name.toLowerCase()] = adapterClass;
  }

  static getSupportedProviders(): string[] {
    return Object.keys(this.registry);
  }
}
