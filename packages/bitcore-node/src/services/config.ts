import cluster from 'cluster';
import loadConfig from '../config';
import logger from '../logger';
import { loadModules } from '../modules';
import { ChainNetwork } from '../types/ChainNetwork';
import { ConfigType } from '../types/Config';
import { valueOrDefault } from '../utils';

type ServiceName = keyof ConfigType['services'];

export class ConfigService {
  config: ConfigType;

  constructor({ config = loadConfig() } = {}) {
    this.config = config;

    // Listen for SIGUSR1 on both main and child processes
    process.on('SIGUSR1', () => {
      const changes = this.reload();
      // Reload all modules with any changes in the config
      if (changes.chains) {
        for (const chain of Object.keys(changes.chains)) {
          for (const network of Object.keys(changes.chains[chain])) {
            loadModules({ chain, network });
          }
        }
      }
    });
  }

  public reload(): Partial<ConfigType> {
    const oldConfig = this.config;
    this.config = loadConfig();

    // Only show config change for one process
    if (!cluster.isPrimary)
      return {};
    const diff = (obj1: object, obj2: object, path: string[] = []): Partial<ConfigType> => {
      const changes = {};
      const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      for (const key of keys) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        const currentPath = [...path, key];
        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
          Object.assign(changes, diff(val1, val2, currentPath));
        } else if (val1 !== val2) {
          let propChange = { old: val1 ?? null, new: val2 ?? null };
          for (const prop of currentPath.reverse()) {
            (propChange as any) = { [prop]: propChange };
          }
          Object.assign(changes, propChange);
          logger.info(`${currentPath.reverse().join('.')} ${JSON.stringify(val1)} -> ${JSON.stringify(val2)}`);
        }
      }
      return changes;
    };

    const changes = diff(oldConfig, this.config);
    return changes;
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
