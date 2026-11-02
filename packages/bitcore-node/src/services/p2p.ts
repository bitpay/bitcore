import * as os from 'os';
import { ObjectID } from 'mongodb';
import logger from '../logger';
import { BaseBlock } from '../models/baseBlock';
import { StateStorage } from '../models/state';
import { IBlock } from '../types/Block';
import { Class } from '../types/Class';
import { wait } from '../utils';
import { Config, ConfigService } from './config';

// how long stop() waits for a renewal in flight before it gives up resigning
const RENEWAL_WAIT_MS = 5000;

// resolves to fallback if promise has not settled within ms
async function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer;
  const timeout = new Promise<T>(resolve => (timer = setTimeout(() => resolve(fallback), ms)));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class P2pManager {
  workerClasses: { [chain: string]: Class<BaseP2PWorker> } = {};

  private configService: ConfigService;
  public workers: Array<BaseP2PWorker>;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.workers = new Array<BaseP2PWorker>();
  }

  register(chain: string, network: string, worker: Class<BaseP2PWorker<any>>) {
    this.workerClasses[chain] = this.workerClasses[chain] || {};
    this.workerClasses[chain][network] = worker;
  }

  get(chain: string, network: string) {
    return this.workerClasses[chain][network];
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

    for (const chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if ((chainConfig.chainSource && chainConfig.chainSource !== 'p2p') || chainConfig.disabled) {
        continue;
      }
      logger.info(`Starting P2P worker ${chain}:${network}`);
      const p2pWorker = new this.workerClasses[chain][network]({
        chain,
        network,
        chainConfig
      });
      this.workers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e: any) {
        logger.error('P2P Worker %o:%o died: %o', chain, network, e.stack || e.message || e);
      }
    }
  }
}

export class BaseP2PWorker<T extends IBlock = IBlock> {
  protected lastHeartBeat = '';
  protected renewal?: Promise<void>;
  // the state document holding the heartbeat, as last read
  protected stateId?: ObjectID;
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
    // the other node's heartbeat this worker is waiting on, and when to take over if it is not renewed
    let takeover: { heartBeat: string; at: number } | undefined;
    // the node this worker last logged as holding the heartbeat
    let loggedHolder: string | undefined;
    while (!this.stopping) {
      const wasSyncingNode = this.getIsSyncingNode();
      const found = await StateStorage.findSyncingNode({ chain: this.chain, network: this.network });
      this.lastHeartBeat = found.heartBeat;
      this.stateId = found.stateId;
      if (this.stopping) {
        break;
      }
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
        loggedHolder = undefined;
        this.registerSyncingNode();
      } else {
        const holder = this.lastHeartBeat.split(':').slice(0, 2).join(':');
        if (holder !== loggedHolder) {
          logger.info(`${holder} is the syncing node for ${this.chain} ${this.network}`);
          loggedHolder = holder;
        }
        if (takeover?.heartBeat !== this.lastHeartBeat) {
          takeover = { heartBeat: this.lastHeartBeat, at: Date.now() + 5 * 60 * 1000 };
        }
        if (Date.now() >= takeover.at) {
          this.registerSyncingNode();
        }
      }
      await wait(500);
    }
  }

  // one nomination at a time, not awaited: the loop keeps reading, so a stalled renewal still lets the heartbeat expire
  registerSyncingNode() {
    if (!this.renewal) {
      this.renewal = StateStorage.selfNominateSyncingNode({
        chain: this.chain,
        network: this.network,
        lastHeartBeat: this.lastHeartBeat,
        stateId: this.stateId
      })
        .catch(err => logger.error('Error in selfNominateSyncingNode:', err))
        .then(() => {
          this.renewal = undefined;
        });
    }
  }

  async unregisterSyncingNode() {
    await wait(1000);
    // A nomination that lands after resigning would claim the heartbeat again. If one hasn't settled in time, leave
    // the heartbeat to expire rather than hold up stop().
    if (this.renewal && !(await within(this.renewal.then(() => true), RENEWAL_WAIT_MS, false))) {
      logger.warn(`Leaving the ${this.chain} ${this.network} syncing node heartbeat to expire: a renewal is still in flight`);
      return;
    }
    try {
      const found = await StateStorage.findSyncingNode({ chain: this.chain, network: this.network });
      this.lastHeartBeat = found.heartBeat;
      if (this.getIsSyncingNode()) {
        await StateStorage.selfResignSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat: this.lastHeartBeat,
          stateId: found.stateId
        });
      }
    } catch (e: any) {
      logger.warn('Issue unregistering');
      logger.error('%o', e);
    }
  }
}

export const P2P = new P2pManager();
