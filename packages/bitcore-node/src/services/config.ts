import loadConfig from '../config';
import { ChainNetwork } from '../types/ChainNetwork';
import { ConfigType } from '../types/Config';
import { valueOrDefault } from '../utils';

type ServiceName = keyof ConfigType['services'];

export class ConfigService {
  config: ConfigType;

  constructor({ config = loadConfig() } = {}) {
    this.config = config;
  }

  public reload() {
    this.config = loadConfig();
  }

  public get() {
    return this.config;
  }

  public updateConfig(partialConfig: Partial<ConfigType>) {
    const newConfig = Object.assign({}, this.get(), partialConfig);
    this.config = newConfig;
  }

  public chains() {
    return Object.keys(this.get().chains);
  }

  public networksFor(chain: keyof ConfigType['chains']) {
    return Object.keys(this.get().chains[chain]);
  }

  public chainNetworks(): Array<ChainNetwork> {
    const chainNetworks = new Array<ChainNetwork>();
    for (const chain of this.chains()) {
      for (const network of this.networksFor(chain)) {
        chainNetworks.push({ chain, network });
      }
    }
    return chainNetworks;
  }

  public chainConfig({ chain, network }: ChainNetwork) {
    return this.get().chains[chain][network];
  }

  public for<T extends keyof ConfigType['services']>(service: T): ConfigType['services'][T] {
    return this.get().services[service] || {};
  }

  public isDisabled(service: ServiceName) {
    const serviceConfig = this.for(service);
    const isDefined = x => x !== undefined;
    const disabled = isDefined(serviceConfig) ? valueOrDefault(serviceConfig.disabled, false) : false;
    return disabled;
  }

  public aliasFor({ chain, network }: { chain: string; network: string }) {
    let aliasChain = chain;
    let aliasNetwork = network;
    const aliasMapping = this.get().aliasMapping;
    if (aliasMapping.chains[chain]) {
      aliasChain = aliasMapping.chains[chain];
    }
    if (aliasMapping.networks[aliasChain]?.[network]) {
      aliasNetwork = aliasMapping.networks[aliasChain][network];
    }
    return { chain: aliasChain, network: aliasNetwork };
  }
}

export const Config = new ConfigService();
