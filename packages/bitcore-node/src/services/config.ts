import { ConfigType } from '../types/Config';
import config from '../config';

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

  public for<T extends keyof ConfigType['services']>(service: T): ConfigType['services'][T] {
    return this.get().services[service];
  }

  public isEnabled(service: ServiceName) {
    return this.get().services[service].enabled;
  }
}

export const Config = new ConfigService();
