import logger from '../logger';
import { BaseBlock } from '../models/baseBlock';
import { StateStorage } from '../models/state';
import { IBlock } from '../types/Block';
import { Class } from '../types/Class';
import { wait } from '../utils';
import { Config, ConfigService } from './config';

// A standby takes over a heartbeat that has not changed for TAKEOVER_MS. The syncing node gives it up LEASE_MS after
// its last confirmed renewal, which leaves it time to shut down (forced after 30 seconds) before anyone takes over.
const TAKEOVER_MS = 5 * 60 * 1000;
const LEASE_MS = 4 * 60 * 1000;
// how long stop() waits for the worker's writes to finish before it gives up resigning
const STOP_WAIT_MS = 15000;

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
    // in parallel, so a worker that is slow to stop doesn't hold up the others resigning
    await Promise.all(this.workers.map(worker => worker.stop()));
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
  protected writes = new Set<Promise<unknown>>();
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
    const [, , timestamp, processId] = this.lastHeartBeat.split(':');
    const processMatches = processId === StateStorage.processId;
    const timestampIsFresh = Date.now() - parseInt(timestamp) < LEASE_MS;
    const amSyncingNode = processMatches && timestampIsFresh;
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
    while (!this.stopping) {
      const wasSyncingNode = this.isSyncingNode;
      this.lastHeartBeat = await this.readHeartBeat(wasSyncingNode);
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
        this.registerSyncingNode();
      } else {
        logger.info('Another node is the primary syncing node');
        if (takeover?.heartBeat !== this.lastHeartBeat) {
          takeover = { heartBeat: this.lastHeartBeat, at: Date.now() + TAKEOVER_MS };
        }
        if (Date.now() >= takeover.at) {
          this.registerSyncingNode();
        }
      }
      await wait(500);
    }
  }

  // A read that fails or doesn't come back before the syncing node's lease ends keeps the last heartbeat read, which
  // the lease has then outlived.
  async readHeartBeat(wasSyncingNode: boolean): Promise<string> {
    const lastHeartBeat = this.lastHeartBeat;
    const read = () =>
      StateStorage.getSyncingNode({ chain: this.chain, network: this.network }).catch(err => {
        logger.error('Error reading the syncing node heartbeat: %o', err);
        return lastHeartBeat;
      });
    if (!wasSyncingNode) {
      return read();
    }
    const leaseLeft = parseInt(lastHeartBeat.split(':')[2]) + LEASE_MS - Date.now();
    return leaseLeft > 0 ? within(read(), leaseLeft, lastHeartBeat) : lastHeartBeat;
  }

  // one nomination at a time, not awaited: the loop keeps reading, so a stalled renewal still lets the heartbeat expire
  registerSyncingNode() {
    if (!this.renewal) {
      this.renewal = StateStorage.selfNominateSyncingNode({
        chain: this.chain,
        network: this.network,
        lastHeartBeat: this.lastHeartBeat
      })
        .catch(err => logger.error('Error in selfNominateSyncingNode:', err))
        .then(() => {
          this.renewal = undefined;
        });
    }
  }

  // Runs a sync write unless the worker is stopping. A standby claims a resigned heartbeat on its next pass, so
  // unregisterSyncingNode resigns only once these finish.
  protected async write<R>(fn: () => Promise<R>): Promise<R | undefined> {
    if (this.stopping) {
      return undefined;
    }
    const writing = fn();
    this.writes.add(writing);
    try {
      return await writing;
    } finally {
      this.writes.delete(writing);
    }
  }

  async unregisterSyncingNode() {
    await wait(1000);
    // A renewal landing between reading and resigning would also leave a heartbeat nobody renews. If the writes don't
    // finish in time, leave the heartbeat to expire rather than hold up stop().
    const settled = Promise.allSettled([this.renewal, ...this.writes]).then(() => true);
    if (!(await within(settled, STOP_WAIT_MS, false))) {
      logger.warn(`Leaving the ${this.chain} ${this.network} syncing node heartbeat to expire: writes still in flight`);
      return;
    }
    try {
      this.lastHeartBeat = await StateStorage.getSyncingNode({ chain: this.chain, network: this.network });
      if (this.getIsSyncingNode()) {
        await StateStorage.selfResignSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat: this.lastHeartBeat
        });
      }
    } catch (e: any) {
      logger.warn('Issue unregistering');
      logger.error('%o', e);
    }
  }
}

export const P2P = new P2pManager();
