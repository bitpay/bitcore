import logger from '../logger';
import { BlockStorage } from '../models/block';
import { Config, ConfigService } from './config';

export class P2pManager {
  workers = new Array<BaseP2PWorker>();
  workerClasses: { [chain: string]: Class<BaseP2PWorker> } = {};

  private configService: ConfigService;
  private p2pWorkers: Array<BaseP2PWorker>;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.p2pWorkers = new Array<BaseP2PWorker>();
  }

  register(chain: string, worker: Class<BaseP2PWorker>) {
    this.workerClasses[chain] = worker;
  }

  get(chain: string) {
    return this.workerClasses[chain];
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    for (const worker of this.p2pWorkers) {
      await worker.stop();
    }
  }

  async start({ blockModel = BlockStorage } = {}) {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');

    for (let chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if (chainConfig.chainSource && chainConfig.chainSource !== 'p2p') {
        continue;
      }
      const p2pWorker = new this.workerClasses[chain]({
        chain,
        network,
        chainConfig,
        blockModel
      });
      this.p2pWorkers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e) {
        logger.error('P2P Worker died with', e);
      }
    }
  }
}

export class BaseP2PWorker {
  constructor(protected params: { chain; network; chainConfig; blockModel: typeof BlockStorage }) {}
  async start() {}
  async stop() {}
}

export const P2P = new P2pManager();
