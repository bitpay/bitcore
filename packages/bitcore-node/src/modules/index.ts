import { ChainStateProvider } from '../providers/chain-state';
import { Libs } from '../providers/libs';
import { Api } from '../services/api';
import { Config } from '../services/config';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import { Verification } from '../services/verification';

export interface IService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class BaseModule implements IService {
  internalServices = new Array<IService>();
  constructor(
    protected bitcoreServices: {
      P2P: typeof P2P;
      Storage: typeof Storage;
      Event: typeof Event;
      Api: typeof Api;
      Config: typeof Config;
      CSP: typeof ChainStateProvider;
      Libs: typeof Libs;
      Verification: typeof Verification;
    } = { P2P, Storage, Event, Api, Config, CSP: ChainStateProvider, Libs, Verification }
  ) {}

  async start() {
    for (const service of this.internalServices) {
      await service.start();
    }
  }

  async stop() {
    for (const service of this.internalServices.reverse()) {
      await service.stop();
    }
  }
}

class ModuleManager extends BaseModule {
  internalServices = new Array<IService>();
  loadConfigured() {
    for (const modulePath of Config.get().modules) {
      const moduleClass = require(modulePath).default || (require(modulePath) as Class<BaseModule>);
      this.internalServices.push(new moduleClass(this.bitcoreServices));
    }
  }
}

export const Modules = new ModuleManager();
