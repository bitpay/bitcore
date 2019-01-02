import { ConfigType } from '../types/Config';
import config from '../config';
import { ChainNetwork } from '../types/ChainNetwork';

type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]> };
type ServiceName = keyof ConfigType['services'];

export class ConfigService {
  _config: ConfigType;

  constructor({ _config = config } = {}) {
    this._config = _config;
  }

  public get() {
    return this._config;
  }

  public updateConfig(partialConfig: RecursivePartial<ConfigType>) {
    const newConfig = Object.assign({}, this.get(), partialConfig);
    this._config = newConfig;
  }

  public chains() {
    return Object.keys(this.get().chains);
  }

  public networksFor(chain: keyof ConfigType['chains']) {
    return Object.keys(this.get().chains[chain]);
  }

  public chainNetworks(): Array<ChainNetwork> {
    const chainNetworks = new Array<ChainNetwork>();
    for (let chain of this.chains()) {
      for (let network of this.networksFor(chain)) {
        chainNetworks.push({ chain, network });
      }
    }
    return chainNetworks;
  }

  public chainConfig({chain, network}: ChainNetwork) {
    return this.get().chains[chain][network];
  }

  public for<T extends keyof ConfigType['services']>(service: T): ConfigType['services'][T] {
    return this.get().services[service];
  }

  public isEnabled(service: ServiceName) {
    return this.for(service) && this.for(service).enabled;
  }
}

export const Config = new ConfigService();
