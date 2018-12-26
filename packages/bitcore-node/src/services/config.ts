import { ConfigType } from '../types/Config';
import config from '../config';

type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]> };
type ServiceName = keyof ConfigType['services'];

export class ConfigService {
  _config: ConfigType;

  constructor({ _config = config } = {}) {
    this._config = _config;
  }

  public get current() {
    return this._config;
  }

  public updateConfig(partialConfig: RecursivePartial<ConfigType>) {
    const newConfig = Object.assign({}, this.current, partialConfig);
    this._config = newConfig;
    console.log('Writing', newConfig);
  }

  public for<T extends keyof ConfigType['services']>(service: T): ConfigType['services'][T] {
    return this.current.services[service];
  }

  public isEnabled(service: ServiceName) {
    return this.current.services[service].enabled;
  }
}

export const Config = new ConfigService();
