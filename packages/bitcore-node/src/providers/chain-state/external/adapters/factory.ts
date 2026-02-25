import { IIndexedAPIAdapter } from './IIndexedAPIAdapter';
import { IMultiProviderConfig } from '../../../../types/Config';
import { AlchemyAdapter } from './alchemy';

export class AdapterFactory {
  private static registry: Record<string, new (config: IMultiProviderConfig) => IIndexedAPIAdapter> = {
    alchemy: AlchemyAdapter
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
