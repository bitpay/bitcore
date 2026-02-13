import { IIndexedAPIAdapter } from './IIndexedAPIAdapter';
import { AlchemyAdapter } from './alchemy';

export class AdapterFactory {
  private static registry: Record<string, new (config: any) => IIndexedAPIAdapter> = {
    alchemy: AlchemyAdapter
  };

  static createAdapter(providerName: string, config: any): IIndexedAPIAdapter {
    const AdapterClass = this.registry[providerName.toLowerCase()];
    if (!AdapterClass) {
      throw new Error(
        `Unknown indexed API provider: "${providerName}". ` +
        `Available: ${Object.keys(this.registry).join(', ')}`
      );
    }
    return new AdapterClass(config);
  }

  static registerAdapter(name: string, adapterClass: new (config: any) => IIndexedAPIAdapter): void {
    this.registry[name.toLowerCase()] = adapterClass;
  }

  static getSupportedProviders(): string[] {
    return Object.keys(this.registry);
  }
}
