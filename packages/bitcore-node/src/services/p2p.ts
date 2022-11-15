import * as os from 'os';
import logger from '../logger';
import { BaseBlock, IBlock } from '../models/baseBlock';
import { StateStorage } from '../models/state';
import { wait } from '../utils/wait';
import { Config, ConfigService } from './config';

export class P2pManager {
  workerClasses: { [chain: string]: Class<BaseP2PWorker> } = {};

  private configService: ConfigService;
  public workers: Array<BaseP2PWorker>;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.workers = new Array<BaseP2PWorker>();
  }

  register(chain: string, worker: Class<BaseP2PWorker<any>>) {
    this.workerClasses[chain] = worker;
  }

  get(chain: string) {
    return this.workerClasses[chain];
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    for (const worker of this.workers) {
      await worker.stop();
    }
    this.workers = [];
  }

  async start() {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');

    for (let chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if ((chainConfig.chainSource && chainConfig.chainSource !== 'p2p') || chainConfig.disabled) {
        continue;
      }
      logger.info(`Starting ${chain} p2p worker`);
      const p2pWorker = new this.workerClasses[chain]({
        chain,
        network,
        chainConfig
      });
      this.workers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e) {
        logger.error('P2P Worker died with', e);
      }
    }
  }
}

export class BaseP2PWorker<T extends IBlock = IBlock> {
  protected lastHeartBeat = '';
  protected queuedRegistrations = new Array<NodeJS.Timer>();
  protected stopping = false;
  protected chain = '';
  protected network = '';
  public isSyncingNode = false;

  constructor(protected params: { chain; network; chainConfig; blockModel?: BaseBlock<T> }) {}
  async start(): Promise<any> {}
  async stop(): Promise<any> {}
  async sync(): Promise<any> {}

  getIsSyncingNode(): boolean {
    if (!this.lastHeartBeat) {
      return false;
    }
    const [hostname, pid, timestamp] = this.lastHeartBeat.split(':');
    const hostNameMatches = hostname === os.hostname();
    const pidMatches = pid === process.pid.toString();
    const timestampIsFresh = Date.now() - parseInt(timestamp) < 5 * 60 * 1000;
    const amSyncingNode = hostNameMatches && pidMatches && timestampIsFresh;
    return amSyncingNode;
  }

  async waitTilSync() {
    while (true) {
      if (this.isSyncingNode) {
        return;
      }
      await wait(500);
    }
  }

  async refreshSyncingNode() {
    while (!this.stopping) {
      const wasSyncingNode = this.getIsSyncingNode();
      this.lastHeartBeat = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
      const nowSyncingNode = this.getIsSyncingNode();
      this.isSyncingNode = nowSyncingNode;
      if (wasSyncingNode && !nowSyncingNode) {
        throw new Error('Syncing Node Renewal Failure');
      }
      if (!wasSyncingNode && nowSyncingNode) {
        logger.info(`This worker is now the syncing node for ${this.chain} ${this.network}`);
        this.sync();
      }
      if (!this.lastHeartBeat || this.getIsSyncingNode()) {
        this.registerSyncingNode({ primary: true });
      } else {
        logger.info('Another node is the primary syncing node');
        this.registerSyncingNode({ primary: false });
      }
      await wait(500);
    }
  }

  async registerSyncingNode({ primary }) {
    const lastHeartBeat = this.lastHeartBeat;
    const queuedRegistration = setTimeout(
      () => {
        StateStorage.selfNominateSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat
        });
      },
      primary ? 0 : 5 * 60 * 1000
    );
    this.queuedRegistrations.push(queuedRegistration);
  }

  async unregisterSyncingNode() {
    await wait(1000);
    try {
      this.lastHeartBeat = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
      if (this.getIsSyncingNode()) {
        await StateStorage.selfResignSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat: this.lastHeartBeat
        });
      }
    } catch (e) {
      logger.warn('Issue unregistering');
      logger.error(e);
    }
  }
}

export const P2P = new P2pManager();
