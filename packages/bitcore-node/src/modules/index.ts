import logger from '../logger';
import { Config } from '../services/config';
import { ChainNetwork } from '../types/ChainNetwork';

export function loadModules(params: Partial<ChainNetwork> = {}) {
  // Chain names -> module paths map
  const DEFAULT_MODULE_PATHS = {
    BTC: './bitcoin',
    ETH: './ethereum',
    MATIC: './matic',
    BCH: './bitcoin-cash',
    DOGE: './dogecoin',
    LTC: './litecoin',
    XRP: './ripple',
    SOL: './solana'
  };
  const chains = params.chain ? [params.chain] : Config.chains();

  // Auto register known modules from config.chains
  for (const chain of chains) {
    const defaultModulePath = DEFAULT_MODULE_PATHS[chain];

    // Register for each
    const networks = params.network ? [params.network] : Config.networksFor(chain);
    for (const network of networks) {
      const config = Config.chainConfig({ chain, network });
      const modulePath = config.module || defaultModulePath; // custom module path
      if (!modulePath) {
        logger.warn(`Module not found for ${chain}:${network}. Did you forget to specify 'module' in the config?`);
        continue;
      }
      logger.info(`Registering module for ${chain}:${network}: ${modulePath}`);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loadedModule = require(modulePath);
      const register = loadedModule.default ?? loadedModule;
      if (typeof register !== 'function') {
        throw new TypeError(`Invalid module for ${chain}:${network} at ${modulePath}: expected a default export or module.exports to be a register function`);
      }
      register({ chain, network });
    }
  }
}
