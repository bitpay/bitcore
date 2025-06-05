import logger from '../logger';
import { ChainStateProvider } from '../providers/chain-state';
import { Libs } from '../providers/libs';
import { Api } from '../services/api';
import { Config } from '../services/config';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import { Verification } from '../services/verification';
import { ChainNetwork } from '../types/ChainNetwork';

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

  // Chain names -> module paths map
  DEFAULT_MODULE_PATHS = {
    BTC: './bitcoin',
    ETH: './ethereum',
    MATIC: './matic',
    BCH: './bitcoin-cash',
    DOGE: './dogecoin',
    LTC: './litecoin',
    XRP: './ripple'
  };

  loadConfigured(params: Partial<ChainNetwork> = {}) {
    const chains = params.chain ? [params.chain] : Config.chains();

    // Auto register known modules from config.chains
    for (const chain of chains) {
      let modulePath = this.DEFAULT_MODULE_PATHS[chain];

      // Register for each
      const networks = params.network ? [params.network] : Config.networksFor(chain);
      for (const network of networks) {
        const config = Config.chainConfig({ chain, network });
        modulePath = config.module || modulePath; // custom module path
        if (!modulePath) {
          logger.warn(`Module not found for ${chain}:${network}. Did you forget to specify 'module' in the config?`);
          continue;
        }
        logger.info(`Registering module for ${chain}:${network}: ${modulePath}`);
        const ModuleClass: Class<BaseModule> = require(modulePath).default || require(modulePath);
        this.internalServices.push(new ModuleClass(this.bitcoreServices, chain, network, config));
      }
    }
  }
}

export const Modules = new ModuleManager();
