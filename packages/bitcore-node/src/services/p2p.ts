import logger from '../logger';
import { Config, ConfigService } from './config';
import { BitcoreP2pWorker } from "./p2p/btc";
import { EthP2pWorker } from "./p2p/eth";

export class P2pManager {
  workers = new Array<BitcoreP2pWorker>();

  private configService: ConfigService;
  p2pClasses = {
    BTC: BitcoreP2pWorker,
    BCH: BitcoreP2pWorker,
    ETH: EthP2pWorker
  }

  constructor({ configService = Config } = {}) {
    this.configService = configService;
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    for (const worker of this.workers) {
      await worker.stop();
    }
  }

  async start() {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');
    const p2pWorkers = new Array<BitcoreP2pWorker>();
    for (let chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if (chainConfig.chainSource && chainConfig.chainSource !== 'p2p') {
        continue;
      }
      const p2pClass = this.p2pClasses[chain];
      const p2pWorker = new p2pClass({
        chain,
        network,
        chainConfig,
      });
      p2pWorkers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e) {
        logger.error('P2P Worker died with', e);
      }
    }
  }
}


export const P2P = new P2pManager();
